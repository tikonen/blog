#import os, sys, time
import json
import dateutil.parser
from datetime import date, timedelta, datetime

from fabric.api import (local, settings, abort, run, lcd, cd, put)
#from fabric.contrib.console import confirm
#from fabric.api import env

# for each volume, define the how many daily, weekly and monthly backups
# you want to keep. For weekly monday's backup is kept and for the each month
# first monday
# BACKUP_VOLS = {
# 	# Cyz
# 	'vol-a0eab4c9': {'comment': 'cyz1 database', 'days': 7, 'weeks': 4, 'months': 2, "nonew": True },
# 	'vol-d4eab4bd': {'comment': 'cyz1 root (cyz.com)', 'days': 7, 'weeks': 4, 'months': 2, "nonew": True},
# 	'vol-fa09ffae': {'comment': 'cyz2 root', 'days': 7, 'weeks': 4, 'months': 2, "nonew": True},
# 	'vol-8409f8d0': {'comment': 'cyz3 root', 'days': 7, 'weeks': 4, 'months': 2, "nonew": True},
# 	'vol-21cc7649': {'comment': 'db server root', 'days': 7, 'weeks': 4, 'months': 3, "nonew": True},
# 	'vol-560ee37b': {'comment': 'db server database', 'days': 7, 'weeks': 4, 'months': 0, "nonew": True},
# 	'vol-bb887aef': {'comment': 'db2 server root', 'days': 7, 'weeks': 4, 'months': 2, "nonew": True},
# 	'vol-c1f20095': {'comment': 'db2 server database', 'days': 7, 'weeks': 4, 'months': 2, "nonew": True},
#
# 	'vol-86ff73ef': {'comment': 'nux.com root', 'days': 7, 'weeks': 4, 'months': 2},
# 	'vol-dee6c78b': {'comment': 'nux.net root (64bit)', 'days': 7, 'weeks': 4, 'months': 2},
# }

today = date.today()

snapshots = {}
hastoday = {}
savedays = {}	# retained snapshot days for each volume


def init(conffile):
	fp = open(conffile, "r")
	global BACKUP_VOLS
	BACKUP_VOLS = json.load(fp, "utf-8")

	for (volume, conf) in BACKUP_VOLS.items():
		daylist = savedays[volume] = []
		# last n days
		for c in range(conf['days'] - 1, -1, -1):
			daylist.append(today - timedelta(days=c))
		# last n weeks (get mondays)
		monday = today - timedelta(days=today.isoweekday() - 1)
		daylist.append(monday)
		for c in range(conf['weeks'] - 1, 0, -1):
			daylist.append(monday - timedelta(days=c * 7))
		# last n months (first monday of month)
		for c in range(conf['months'] - 1, -1, -1):
			year = today.year
			month = today.month - c
			if month <= 0:
				year = year - 1
				month = 12 + month
			firstmonday = datetime(year, month, 1).date()
			if firstmonday.isoweekday() != 1:
				firstmonday = firstmonday + timedelta(days=7 - firstmonday.isoweekday() + 1)
			daylist.append(firstmonday)
			#daylist.append(datetime(today.year, today.month - c, 1).date())

	snapshots_data = local('ec2-describe-snapshots', capture=True).split('\n')

	snapshots_data = [tuple(l.split('\t'))[:9] for l in snapshots_data if l.startswith('SNAPSHOT')]
	for (_, snapshot, volume, status, datestr, progress, _, _, _) in snapshots_data:
		snapshotdate = dateutil.parser.parse(datestr).date()
		if volume in BACKUP_VOLS:
			if snapshotdate == today:
				hastoday[volume] = {'status': status, 'snapshot': snapshot, 'progress': progress.replace('%', '')}
			if volume not in snapshots:
				snapshots[volume] = []
			snapshots[volume].append((snapshot, status, snapshotdate))

	# sort by date
	for snapshotlist in snapshots.values():
		snapshotlist.sort(key=lambda x: x[2], reverse=True)

	for volume in BACKUP_VOLS.keys():
		if volume not in snapshots:
			snapshots[volume] = []

	print "VOLUME\tSNAPSHOT\tSTATUS\tDATE\tDESC"
	for (volume, snapshotlist) in snapshots.items():
		for (snapshot, status, date) in snapshotlist:
			datestr = date.strftime('%Y-%m-%d')
			print "%s\t%s\t%s\t%s\t%s" % (volume, snapshot, status, datestr, BACKUP_VOLS[volume]['comment'])

def status(conffile="ec2backup.json"):
	init(conffile)


def backup(dryrun=False, conffile="ec2backup.json"):
	init(conffile)
	print "\nCREATING SNAPSHOTS"
	for (volume, snapshotlist) in snapshots.items():
		if BACKUP_VOLS[volume].get("nonew", False):
			print '%s skipping "%s"' % (volume, BACKUP_VOLS[volume]['comment'])
			continue

		if volume in hastoday:
			print '%s has %s%% %s snapshot %s for today "%s"' % (volume,
															hastoday[volume]['progress'],
															hastoday[volume]['status'],
															hastoday[volume]['snapshot'],
															BACKUP_VOLS[volume]['comment'])
		else:
			print '%s creating snapshot "%s"' % (volume, BACKUP_VOLS[volume]['comment'])
			snapshotlist.insert(0, ('new', 'incomplete', today))
			if not dryrun:
				local('ec2-create-snapshot %s -d "%s"' % (volume, BACKUP_VOLS[volume]['comment']))

	print "\nDELETING OLD SNAPSHOTS"
	for (volume, snapshotlist) in snapshots.items():
		# unless purge is set to true, leave last snapshot untouched
		if BACKUP_VOLS[volume].get("nonew", False) and not BACKUP_VOLS[volume].get("purge", False):
			if len(snapshotlist) > 0:
				(snapshot, _, date) = snapshotlist[0]
				datestr = date.strftime('%Y-%m-%d')
				print "%s skip %s %s (%s)" % (volume, snapshot, datestr, BACKUP_VOLS[volume]['comment'])
				snapshotlist = snapshotlist[1:]

		for (snapshot, _, date) in snapshotlist:
			if not date in savedays[volume]:
				datestr = date.strftime('%Y-%m-%d')
				print "%s deleting %s %s (%s)" % (volume, snapshot, datestr, BACKUP_VOLS[volume]['comment'])
				if not dryrun:
					with settings(warn_only=True):
						local('ec2-delete-snapshot %s' % snapshot)


def dryrun(conffile="ec2backup.json"):
	print """

*** DRY RUN ***

"""
	backup(True, conffile)

import os, sys, time
import dateutil.parser
from datetime import date, timedelta, datetime

from fabric.api import (local, settings, abort, run, lcd, cd, put)
from fabric.contrib.console import confirm
from fabric.api import env

# for each volume, define the how many daily, weekly and monthly backups
# you want to keep. For weekly monday's backup is kept and for the each month
# the one from 1st day.
BACKUP_VOLS = {
	'vol-de31a8b7': {'comment': 'my.com root', 'days': 7, 'weeks': 4, 'months': 4},
	'vol-21cc7649': {'comment': 'db server root', 'days': 7, 'weeks': 4, 'months': 4},
	'vol-560ee37b': {'comment': 'db server database', 'days': 7, 'weeks': 4, 'months': 4},
}

today = date.today()

snapshots = {}
hastoday = {}
savedays = {}	# retained snapshot days for each volume

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
	# last n months (first day of month)
	for c in range(conf['months'] - 1, -1, -1):
		year = today.year
		month = today.month - c
		if month <= 0:
			year = year - 1
			month = 12 + month
		daylist.append(datetime(year, month, 1).date())

SNAPSHOTS = local('ec2-describe-snapshots', capture=True).split('\n')

SNAPSHOTS = [tuple(l.split('\t')) for l in SNAPSHOTS if l.startswith('SNAPSHOT')]

for (_, snapshot, volume, status, datestr, progress, _, _, _) in SNAPSHOTS:
	snapshotdate = dateutil.parser.parse(datestr).date()
	if volume in BACKUP_VOLS:
		if snapshotdate == today:
			hastoday[volume] = {'status': status, 'snapshot': snapshot, 'progress': progress.replace('%', '')}
		if volume not in snapshots:
			snapshots[volume] = []
		snapshots[volume].append((snapshot, status, snapshotdate))

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


def status():
	pass


def backup(dryrun=False):
	print "\nCREATING SNAPSHOTS"
	for (volume, snapshotlist) in snapshots.items():
		if volume in hastoday:
			print '%s has %s%% %s snapshot %s for today "%s"' % (volume,
															hastoday[volume]['progress'],
															hastoday[volume]['status'],
															hastoday[volume]['snapshot'],
															BACKUP_VOLS[volume]['comment'])
		else:
			print 'creating snapshot for %s "%s"' % (volume, BACKUP_VOLS[volume]['comment'])
			snapshotlist.insert(0, ('new', 'incomplete', today))
			if not dryrun:
				local('ec2-create-snapshot %s -d "%s"' % (volume, BACKUP_VOLS[volume]['comment']))

	print "\nDELETING OLD SNAPSHOTS"
	for (volume, snapshotlist) in snapshots.items():
		for (snapshot, _, date) in snapshotlist:
			if not date in savedays[volume]:
				datestr = date.strftime('%Y-%m-%d')
				print "deleting %s %s for %s (%s)" % (snapshot, datestr, volume, BACKUP_VOLS[volume]['comment'])
				if not dryrun:
					with settings(warn_only=True):
						local('ec2-delete-snapshot %s' % snapshot)


def dryrun():
	print """

*** DRY RUN ***

"""
	backup(dryrun=True)

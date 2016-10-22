#!/usr/bin/env python

import xmlrpclib
import sys
import urllib2
import re

# Scripts resolves current external address of the EC2 server and updates
# the corresponding Gandi Zone A records to point to this ip.

# CONFIGURATION
DOMAIN="yourdomain.com" # the domain name to update
NAMES=["@", "www"]      # A record names to update
API_KEY = '*********'   # fill in gandi API key

DRY_RUN = True          # Set false to actually modify Zone

api = xmlrpclib.ServerProxy('https://rpc.gandi.net/xmlrpc/')
# for testing use this api endpoint
#api = xmlrpclib.ServerProxy('https://rpc.ote.gandi.net/xmlrpc/')

# Resolves external ip
def resolve_ip():
	# get ip of the EC2 instance
	# http://instance-data/latest/meta-data/local-ipv4
	# http://instance-data/latest/meta-data/public-ipv4
	print "Resolving external IP"
	newip = urllib2.urlopen('http://instance-data/latest/meta-data/public-ipv4').read()
	# check that we received a valid IP
	if not re.match("[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}", newip):
		print "ERROR: Invalid ip '%s'" % newip
		sys.exit(1)
	return newip

# Updates the ip of Zone's A records
def update_ip(newip):
	print "Getting domain info for %s" % DOMAIN
	info = api.domain.info(API_KEY, DOMAIN)

	if "zone_id" not in info:
		print "ERROR: Unable to domain info"
		sys.exit(1)

	print info
	zone_id = info['zone_id']

	print "Getting records for zone_id: %s " % zone_id
	records = api.domain.zone.record.list(API_KEY, zone_id, 0)
	print records

	# check if records need updating
	for record in records:
		if record['type'] == "A" and record['name'] in NAMES:
			if record['value'] == newip:
				NAMES.remove(record['name'])

	if not NAMES:
		print "Records already up to date, nothing to do"
		sys.exit(0)

	if not DRY_RUN:
		print "Updating records: %s" % NAMES
		print "Creating new zone version"
		version = api.domain.zone.version.new(API_KEY, zone_id)
		api.domain.zone.record.delete(API_KEY, zone_id, version, { "type" : [ "A", "CNAME"], "name" : NAMES })
		
		for name in NAMES:
			api.domain.zone.record.add(API_KEY, zone_id, version, { "type" : "A", "ttl": 3600, "name": name, "value": newip })
		
		print "Activating version: %s" % version
		api.domain.zone.version.set(API_KEY, zone_id, version) # set active
		print "Records updated"
		records = api.domain.zone.record.list(API_KEY, zone_id, 0)
		print records
	else:
		print "DRY_RUN: no records updated"

newip = resolve_ip()
print "External IP %s" % newip
update_ip(newip)





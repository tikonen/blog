#!/usr/bin/env python
import requests
import json
import urllib2
import re
import sys

# Configuration
DOMAIN="yourdomain.com" # Your domain here
NAMES=["*", "@", "www"] # Host names
API_KEY = 'WW91ciBBUEkga2V5IGhlcmUK' # API key
DRY_RUN = False


# get ip of EC2 instance
# http://instance-data/latest/meta-data/local-ipv4
# http://instance-data/latest/meta-data/public-ipv4
print "Resolving external IP"
newip = urllib2.urlopen('http://instance-data/latest/meta-data/public-ipv4').read()

# check that we received a valid IP
if not re.match("[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}", newip):
	print "ERROR: Invalid ip '%s'" % newip
	sys.exit(1)

print "External IP %s" % newip

print "Getting domain records for %s" % DOMAIN
headers = {'X-Api-Key':API_KEY}
resp = requests.get('https://dns.api.gandi.net/api/v5/domains/%s/records' % DOMAIN, headers=headers)

if not resp.ok:
	print "ERROR: Unable to domain info"
	sys.exit(1)

records = resp.json()
print json.dumps(records, indent=4, sort_keys=True)

updated_records=[]

for record in records:
        if record["rrset_type"] != "A":
                continue
        if record["rrset_name"] not in NAMES:
                continue
        if record["rrset_values"][0] != newip:
                updated_records.append(record)

if not updated_records:
	print "Records already up to date, nothing to do"
	sys.exit(0)

if not DRY_RUN:
	print "Updating records"
	for record in updated_records:
        url = record.pop("rrset_href")
        record["rrset_values"] = [newip]
        response = requests.put(url, json=record, headers=headers)
        print response.text

	resp = requests.get('https://dns.api.gandi.net/api/v5/domains/%s/records' % DOMAIN, headers=headers)
	print json.dumps(resp.json(), indent=4, sort_keys=True)

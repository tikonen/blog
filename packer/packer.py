#!/usr/bin/python

# The MIT License (MIT)
#
# Copyright (c) 2012-2013 Teemu Ikonen
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.
#
# Tool that accepts multiple images as arguments and tries to fit them to single image
# Image locations are written out as json file.
#
# ImageMagick 6.8 or later must be installed and in the command path. Tool uses commands 'identify' and 'convert'.
#
# $ ./packer.py <image1>, <image2>, ..
#
# Tool outputs atlas image and json and css files that map the image locations on the atlas
#

import subprocess
import argparse
import re
import os, sys
import json

parser = argparse.ArgumentParser(description="Packs images to atlas. Uses ImageMagick to parse and compose the images")
parser.add_argument('files', metavar='FILE', type=str, nargs='+', help="Image file")
parser.add_argument("-o", dest="outfile", type=str, default='out.png', help="Output atlas file")
parser.add_argument("-jo", dest="jsonoutfile", type=str, help="Output atlas json file")
parser.add_argument("-jso", dest="jsoutfile", type=str, help="Output atlas import js file")
parser.add_argument("-co", dest="cssoutfile", type=str, help="Output atlas css file")
parser.add_argument("-p", dest="pad", type=int, default=1, help="Padding")
parser.add_argument("-mw", dest="width", type=int, default=1024, help="Maximum width")
parser.add_argument("-mh", dest="height", type=int, default=1024, help="Maximum height")

args = parser.parse_args()

# Check that ImageMagick is installed
def is_im_installed():
	print "Checking ImageMagick"
	try:
		o = subprocess.check_output(['identify', '--version'], stderr=subprocess.STDOUT).strip()
		if not o.find('ImageMagick'):
			print "\nUnknown output from identify, is ImageMagick installed?"
			return False
		else:
			print 'Found: ' + o.split('\n')[0]
			return True
	except Exception as e:
		print "ImageMagick identity not found:",e
		return False

if not is_im_installed():
	sys.exit(1)

def bname(file):
	l = os.path.basename(file).split('.')
	return ''.join(l[:-1])

if not args.jsonoutfile:
	args.jsonoutfile = os.path.join(os.path.dirname(args.outfile),bname(args.outfile)+ '.json')

if not args.cssoutfile:
	args.cssoutfile = os.path.join(os.path.dirname(args.outfile),bname(args.outfile)+ '.css')

if not args.jsoutfile:
	args.jsoutfile = args.jsonoutfile + '.js'


print "==========================="
print "Resolving file dimensions"

blocks = []

# Use identify command to get file dimensions
for file in args.files:
	try:
		o = subprocess.check_output(['identify', file], stderr=subprocess.STDOUT).strip()
		p = re.compile(r'^[^:]+ ([^\s]+) ([0-9]+)x([0-9]+)')
		m = p.match(o)
		if not m:
			print "\nWARN: unable to identify {0}: {1}".format(file, o)
			continue
		fmt = m.group(1)
		w = int(m.group(2))
		h = int(m.group(3))
		blocks.append({
			'name': file,
			'ow': w,
			'oh': h,
			'w': w + args.pad, # add padding
			'h': h + args.pad
		})
		print "{0} -> {1}x{2}".format(os.path.basename(file), w, h)
	except subprocess.CalledProcessError as e:
		print "\nWARN: failed to process {0} error: {1}".format(file, e.output)


# Area tree packer
def find_node(node, w, h):
	if 'used' in node:
		return find_node(node['right'], w, h) or find_node(node['left'], w, h)
	elif w <= node['w'] and h <= node['h']:
		return node
	else:
		return None

# mark node as used and split it to right and bottom areas
def use_node(node, w, h):
	node['used'] = True
	node['left'] = {'x': node['x'], 'y':node['y']+h, 'w':node['w'],'h':node['h']-h}
	node['right'] = {'x':node['x']+w, 'y':node['y'], 'w':node['w']-w, 'h':h}
	return node


# Fits the blocks to the area and sets p key to the allocated area
def fit(blocks, w, h):
	root = { 'x': 0, 'y': 0, 'w': w, 'h': h }
	for b in blocks:
		node = find_node(root, b['w'], b['h'])
		if node: # location found for this image
			b['p'] = use_node(node, b['w'], b['h'])
		else:
			return False
	return True

print "==========================="
print "fitting {0} images, padding {1}".format(len(blocks), args.pad)


# sort files to suit the simple tree algorithm better
blocks.sort(lambda a,b: b['w'] - a['w'] if a['h'] == b['h'] else b['h'] - a['h'])

# run the packer
if not fit(blocks, args.width, args.height):
	print "ERROR: unable to fit images to {0}x{1} padding {2}".format(args.width, args.height, args.pad)
	sys.exit(1)


w = 0
h = 0
for b in blocks:
	# get size of the output image, decrement padding as borders do not need one
	w = max(w, b['p']['x'] + b['w'] - args.pad)
	h = max(h, b['p']['y'] + b['h'] - args.pad)

	# eliminate the extra padding from output image borders
	sx = b['p']['x'] + int(args.pad/2)
	sy = b['p']['y'] + int(args.pad/2)
	sx = max(0, sx - int(args.pad/2))
	sy = max(0, sy - int(args.pad/2))

	b['p']['x'] = sx
	b['p']['y'] = sy

if not len(blocks):
	print "\nWARN: nothing to do"
	sys.exit(0)

print "successfully fitted {0} images to {1}x{2} padding {3}".format(len(blocks), w, h, args.pad)

info = {}

try:
	# compose images in single atlas
	convert = [
		'convert',
		'-define',
		'png:exclude-chunks:date', # do not set date
		'-size',
		'%sx%s' % (w, h),
		'xc:none', # transparent background
	]
	for b in blocks:
		convert.append(b['name'])
		convert.append('-geometry')
		convert.append('+%s+%s' % (b['p']['x'], b['p']['y']))
		convert.append('-composite')
		info[os.path.basename(b['name'])] = {
			'x': b['p']['x'],
			'y': b['p']['y'],
			'w': b['ow'],
			'h': b['oh']
		}

	convert.append(args.outfile)

	o = subprocess.check_output(convert, stderr=subprocess.STDOUT).strip()
	print "Wrote: atlas to {0}".format(args.outfile)

	# write Raw JSON
	f = open(args.jsonoutfile, 'w')
	f.write(json.dumps(info, sort_keys=True, indent=4))
	f.close()
	print "Wrote json to {0}".format(args.jsonoutfile)

	# write import JS file
	bvar = 'window.bg_' + bname(args.outfile)
	f = open(args.jsoutfile, 'w')
	f.write(bvar+' = '+json.dumps(info, sort_keys=True, indent=4))
	f.close()
	print "Wrote js to {0}".format(args.jsoutfile)


	# write CSS
	bclass = '.bg-' + bname(args.outfile)
	rules = []
	rules.extend([{bclass + '.' + bname(file) : {
		'background': 'url('+os.path.basename(args.outfile)+') no-repeat -%dpx -%dpx' % (b['x'], b['y']),
		'width': ('%dpx' % b['w']),
		'height':('%dpx' % b['h']),
	}} for (file,b) in info.items()])

	def rule2str(rule):
		l = []
		for (key, style) in rule.items():
			sl = []
			for (opt, val) in style.items():
				sl.append('\t%s: %s;' % (opt,val))
			l.append(key + ' {\n' + '\n'.join(sl) +'\n}\n')
		return "\n".join(l)

	f = open(args.cssoutfile, 'w')
	for r in rules:
		f.write(rule2str(r))
	f.close()
	print "Wrote css to {0}\n".format(args.cssoutfile)

except subprocess.CalledProcessError as e:
	print "failed to process, error: {0}".format(e.output),

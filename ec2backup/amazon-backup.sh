#!/bin/bash

export HOME=/home/ubuntu

export JAVA_HOME=/usr
export EC2_HOME=$HOME/ec2-api-tools
export EC2_URL=https://ec2.eu-west-1.amazonaws.com

export LC_CTYPE=en_GB.UTF-8

export AWS_ACCESS_KEY=xyz
export AWS_SECRET_KEY=xyz

PATH=$PATH:$EC2_HOME/bin

echo "=================================="
date
cd $HOME/cron
/usr/local/bin/fab -f ec2-backup.py backup

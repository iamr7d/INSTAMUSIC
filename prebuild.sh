#!/bin/bash
# Remove requirements.txt to prevent Python dependency installation
echo "Removing requirements.txt to prevent Python dependency installation"
rm -f requirements.txt
echo "This is a static site deployment only"
exit 0

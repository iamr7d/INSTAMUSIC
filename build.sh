#!/bin/bash

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Navigate to functions directory and install Node.js dependencies
echo "Installing Node.js dependencies for serverless functions..."
cd netlify/functions
npm install

echo "Build process completed successfully!"

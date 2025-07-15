#!/bin/bash

# Generate self-signed certificate for development HTTPS

echo "Generating self-signed certificate for development..."

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=BudgetPlanner/OU=Development/CN=localhost"

# Set appropriate permissions
chmod 600 certs/key.pem
chmod 644 certs/cert.pem

echo "Certificate generated successfully!"
echo "Files created:"
echo "  - certs/cert.pem (certificate)"
echo "  - certs/key.pem (private key)"
echo ""
echo "Add these files to .gitignore to keep them out of version control."
PixelVault v2.0

Client-Side Steganography and Cryptography Application

PixelVault is a fully offline web application that enables users to hide secret messages inside digital images using Least Significant Bit (LSB) steganography combined with AES-256-GCM encryption.

All operations are performed locally in the user's browser. No data is transmitted to any external server.

## Key Features

- AES-256-GCM encryption with PBKDF2 key derivation (100,000 iterations)
- LSB steganography for data concealment in RGB channels
- Adjustable bit depth (1, 2, or 3 bits per channel) for balancing security and capacity
- Automatic conversion of JPEG images to PNG before embedding
- Real-time capacity calculation
- Password strength indicator
- Automatic bit detection during decoding
- Responsive user interface optimized for desktop and mobile devices
- Web Workers for efficient handling of large images

## Technologies Used

- HTML5, CSS3, Vanilla JavaScript (ES6+)
- Web Crypto API (AES-GCM and PBKDF2)
- HTML5 Canvas API
- Web Workers

## How to Use

### Encoding (Hide Message)
1. Open the Encode tab
2. Upload or drag and drop an image (PNG or JPG)
3. Enter the secret message
4. Provide a strong password
5. Select bits per channel (1 bit is recommended for maximum security)
6. Click Encrypt and Hide Message
7. Download the generated PNG file

### Decoding (Extract Message)
1. Open the Decode tab
2. Upload the previously encoded PNG file
3. Enter the same password used during encoding
4. Click Extract and Decrypt
5. The hidden message will be displayed

## Security Note

This application uses strong AES-256-GCM authenticated encryption. While the hidden data is visually imperceptible, advanced steganalysis techniques may detect the presence of embedded information. This tool is intended for educational and personal use only.

## Project Structure

PixelVault-v2.0/
├── index.html
├── style.css
├── script.js
└── README.md

## Developer

SABBIR MAHMUD ADOR
Bangladesh

Built for privacy and security.

# OpenCV.js Setup for Enhanced PDF Processing

The Budget Planner includes optional OpenCV.js support for enhanced PDF processing. This provides better OCR accuracy for skewed, rotated, or poor-quality scanned documents.

## When to Enable OpenCV.js

Consider enabling OpenCV.js if you frequently process:
- Skewed or rotated bank statements
- Poor quality scanned documents
- Documents with complex layouts or backgrounds

## Setup Instructions

### Option 1: CDN (Recommended for testing)

Add this script tag to your `public/index.html` or load it dynamically:

```html
<script async src="https://docs.opencv.org/4.8.0/opencv.js"></script>
```

### Option 2: Local Installation

1. Download OpenCV.js from the official repository:
```bash
wget https://docs.opencv.org/4.8.0/opencv.js -O public/opencv.js
```

2. Add the script tag to load it:
```html
<script async src="/opencv.js"></script>
```

### Option 3: NPM Package (Advanced)

```bash
npm install opencv-ts
```

Then import and initialize in your application.

## Performance Considerations

- **Bundle Size**: OpenCV.js adds ~8MB to your application
- **Loading Time**: Initial load takes 2-5 seconds depending on connection
- **Processing**: Slightly slower per page but much better accuracy for problematic documents

## Verification

When OpenCV.js is properly loaded, you'll see this message in the console:
```
OpenCV.js detected and working. Using advanced image preprocessing.
```

Without OpenCV.js, you'll see:
```
OpenCV.js not detected. Using basic image preprocessing.
```

## Features Enabled with OpenCV.js

- **Automatic deskewing** of rotated documents
- **Advanced noise removal** using median filtering
- **Adaptive thresholding** for better text contrast
- **Contour-based text detection** for improved accuracy

The application works perfectly fine without OpenCV.js - this is purely an optional enhancement for edge cases. 
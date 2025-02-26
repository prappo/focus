// Create simple icon canvas
function createIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Draw a blue circle with a white F
  ctx.fillStyle = '#4285f4';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size/1.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size/2, size/2);
  
  return canvas.toDataURL();
}

// Create icons of different sizes
const icon16 = createIcon(16);
const icon48 = createIcon(48);
const icon128 = createIcon(128);

// Download function
function downloadIcon(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

// Download icons
downloadIcon(icon16, 'icon16.png');
downloadIcon(icon48, 'icon48.png');
downloadIcon(icon128, 'icon128.png'); 
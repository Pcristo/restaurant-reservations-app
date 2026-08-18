import html2canvas from 'html2canvas';

export const takeScreenshot = async (elementId: string, filename: string = 'screenshot.png') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // High resolution
      useCORS: true,
      backgroundColor: window.getComputedStyle(element).backgroundColor || '#ffffff',
      ignoreElements: (el) => el.classList.contains('no-print') // Using the same class to ignore things we don't want
    });
    
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Error taking screenshot:', err);
  }
};

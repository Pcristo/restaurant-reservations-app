/**
 * Robust print helper function that handles both top-level windows and iframe/embedded preview environments.
 */
export const triggerPrint = (title: string = 'Documento') => {
  // 1. Always attempt the standard window.print() first
  try {
    window.focus();
    window.print();
  } catch (err) {
    console.warn("Direct window.print() was not available:", err);
  }

  // 2. If running inside an iframe, embedded sandbox, or if direct print might be ignored
  if (typeof window !== 'undefined' && window.self !== window.top) {
    try {
      // Remove any existing print helper frame
      const oldFrame = document.getElementById('applet-print-frame');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'applet-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        
        // Collect all CSS links and styles from the parent document
        const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
          .map(el => el.outerHTML)
          .join('\n');

        frameDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>${title}</title>
              ${headStyles}
              <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { 
                  background-color: #ffffff !important; 
                  color: #000000 !important; 
                  margin: 0 !important; 
                  padding: 12px !important; 
                  font-family: inherit !important;
                }
                .no-print { display: none !important; }
                body:has(.fixed.inset-0.z-\[100\]) *:not(.fixed.inset-0.z-\[100\]):not(:has(.fixed.inset-0.z-\[100\])):not(.fixed.inset-0.z-\[100\] *) { display: none !important; }
                body:has(.fixed.inset-0.z-\[100\]) *:has(.fixed.inset-0.z-\[100\]) { margin: 0 !important; padding: 0 !important; background: transparent !important; }
                body:has(.fixed.inset-0.z-\[9990\]) *:not(.fixed.inset-0.z-\[9990\]):not(:has(.fixed.inset-0.z-\[9990\])):not(.fixed.inset-0.z-\[9990\] *) { display: none !important; }
                body:has(.fixed.inset-0.z-\[9990\]) *:has(.fixed.inset-0.z-\[9990\]) { margin: 0 !important; padding: 0 !important; background: transparent !important; }
              </style>
            </head>
            <body>
              <div class="print-wrapper">
                ${document.body.innerHTML}
              </div>
            </body>
          </html>
        `);
        frameDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn("Iframe print invocation error, trying popup window:", e);
            try {
              const popup = window.open('', '_blank', 'width=1000,height=800');
              if (popup) {
                popup.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="utf-8" />
                      <title>${title}</title>
                      ${headStyles}
                      <style>
                        @page { size: A4 landscape; margin: 10mm; }
                        body { background: #ffffff !important; color: #000000 !important; margin: 0 !important; padding: 12px !important; }
                        .no-print { display: none !important; }
                      </style>
                    </head>
                    <body>
                      ${document.body.innerHTML}
                      <script>
                        window.onload = function() {
                          setTimeout(function() {
                            window.focus();
                            window.print();
                          }, 300);
                        };
                      </script>
                    </body>
                  </html>
                `);
                popup.document.close();
              }
            } catch (popupErr) {
              console.error("Popup window print error:", popupErr);
            }
          }
        }, 350);
      }
    } catch (e) {
      console.error("Print utility error:", e);
    }
  }
};

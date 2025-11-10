import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeError, Html5QrcodeResult } from 'html5-qrcode';
// --- MODIFICATION: Import RefreshCw for the new button ---
import { CameraOff, AlertTriangle, RefreshCw } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // --- NEW: A key to force re-mounting of the scanner element ---
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    // This effect will now re-run whenever remountKey changes.
    
    // --- MODIFICATION: Only initialize if not already initialized ---
    if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
    }
    const html5QrCode = scannerRef.current;

    // Clear previous errors when we try to start
    setError(null);

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const handleScanSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop();
      }
      onScanSuccess(decodedText);
      onClose();
    };

    const handleScanError = (errorMessage: string, error: Html5QrcodeError) => { /* Ignore */ };

    const startScanner = () => {
        Html5Qrcode.getCameras()
          .then(devices => {
            if (devices && devices.length) {
              let cameraId = devices[0].id;
              const backCamera = devices.find(device => device.label.toLowerCase().includes('back'));
              if (backCamera) {
                cameraId = backCamera.id;
              }
              
              html5QrCode.start(
                cameraId,
                config,
                handleScanSuccess,
                handleScanError
              ).catch(err => {
                  setError("Failed to start the camera. Please ensure it's not in use by another application.");
                  console.error("Failed to start scanner:", err);
              });
            } else {
              setError("No cameras found on this device.");
            }
          })
          .catch(err => {
            setError("Could not get camera permissions. Please enable camera access for this site in your browser settings.");
            console.error("Permission error:", err);
          });
    };
    
    startScanner();

    // Cleanup function
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Failed to stop scanner cleanly.", err));
      }
    };
  }, [remountKey, onScanSuccess, onClose]); // --- MODIFICATION: Add remountKey to dependency array ---

  return (
    <div className="bg-black p-4 rounded-lg relative">
      {/* --- MODIFICATION: Added a key to the reader div --- */}
      <div id="qr-reader" key={remountKey} className="rounded-lg overflow-hidden"></div>
      
      {!error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[280px] h-[280px] border-4 border-accent rounded-lg shadow-lg" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}></div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center text-center p-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Camera Error</h3>
            <p className="text-sm text-gray-300 mb-6">{error}</p>
            {/* --- NEW: The 'Try Again' button --- */}
            <button
                onClick={() => setRemountKey(prev => prev + 1)} // This triggers the useEffect to re-run
                className="w-full flex items-center justify-center gap-2 p-3 bg-accent hover:bg-blue-700 rounded-lg text-white font-semibold mb-3"
            >
                <RefreshCw size={20} />
                Try Again
            </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-4 w-full flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold"
      >
        <CameraOff size={20}/>
        Cancel Scan
      </button>
    </div>
  );
};

export default QrScanner;
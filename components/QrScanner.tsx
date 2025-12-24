import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeError, Html5QrcodeResult } from 'html5-qrcode';
import { CameraOff, AlertTriangle, RefreshCw, Zap, ZapOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const QrScanner: React.FC<QrScannerProps> = ({ onScanSuccess, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // --- NEW: A key to force re-mounting of the scanner element ---
  const [remountKey, setRemountKey] = useState(0);
  
  // --- NEW: Torch support ---
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  useEffect(() => {
    // This effect will now re-run whenever remountKey changes.
    
    // --- MODIFICATION: Only initialize if not already initialized ---
    if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
    }
    const html5QrCode = scannerRef.current;

    // Clear previous errors when we try to start
    setError(null);

    // Optimized constraints for Mobile
    const config = { 
        fps: 20, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0 
    };

    const handleScanSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop();
      }
      onScanSuccess(decodedText);
      onClose();
    };

    const handleScanError = (errorMessage: string, error: Html5QrcodeError) => { /* Ignore */ };

    const startScanner = async () => {
        try {
            // Use facingMode: environment for best rear camera selection on mobile
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                handleScanSuccess,
                handleScanError
            );

            // Check for Torch capability
            const track = html5QrCode.getRunningTrack();
            const capabilities: any = track.getCapabilities();
            if (capabilities.torch) {
                setHasTorch(true);
            }
        } catch (err) {
            setError("Failed to start the camera. Please ensure permissions are granted.");
            console.error("Scanner error:", err);
        }
    };
    
    startScanner();

    // Cleanup function
    return () => {
      if (html5QrCode) {
        const stopAndClear = async () => {
            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
            }
            try {
                html5QrCode.clear();
            } catch (e) {
                // Ignore clear errors on unmount
            }
        };
        stopAndClear();
      }
    };
  }, [remountKey, onScanSuccess, onClose]); // --- MODIFICATION: Add remountKey to dependency array ---

  return (
    <div className="bg-black p-4 rounded-lg relative">
      {/* --- MODIFICATION: Added a key to the reader div --- */}
      <div id="qr-reader" key={remountKey} className="rounded-lg overflow-hidden"></div>
      
      {/* Flashlight Toggle */}
      {hasTorch && (
        <button 
            onClick={async () => {
                const nextState = !isTorchOn;
                try {
                    await scannerRef.current?.applyVideoConstraints({
                        advanced: [{ torch: nextState }] as any
                    });
                    setIsTorchOn(nextState);
                } catch (e) { toast.error("Flashlight not available"); }
            }}
            className={`absolute top-6 left-6 z-10 p-3 rounded-full shadow-lg transition-colors ${isTorchOn ? 'bg-yellow-400 text-black' : 'bg-black/50 text-white'}`}
        >
            {isTorchOn ? <ZapOff size={24} /> : <Zap size={24} />}
        </button>
      )}

      {!error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[280px] h-[280px] border-4 border-accent rounded-lg shadow-lg relative" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}>
                <div className="scan-laser"></div>
            </div>
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
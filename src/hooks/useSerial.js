import { useState, useEffect, useRef } from 'react';

export function useSerial() {
  const [port, setPort] = useState(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [status, setStatus] = useState('Disconnected');
  const [lastEmergencyStopAt, setLastEmergencyStopAt] = useState(0);
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const keepReadingRef = useRef(true);
  const abortSendRef = useRef(false);

  const connect = async () => {
    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });
      setPort(selectedPort);
      setConnected(true);
      keepReadingRef.current = true;
      
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
      readerRef.current = textDecoder.readable.getReader();

      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(selectedPort.writable);
      writerRef.current = textEncoder.writable.getWriter();
      abortSendRef.current = false;

      setStatus('Connected');
      readLoop();

      // Wake up grbl
      await sendRealtimeCommand('\r\n\r\n');
    } catch (err) {
      console.error('Serial connection error:', err);
    }
  };

  const disconnect = async () => {
    keepReadingRef.current = false;
    abortSendRef.current = true;
    if (readerRef.current) {
      await readerRef.current.cancel();
      readerRef.current = null;
    }
    if (writerRef.current) {
      await writerRef.current.close();
      writerRef.current = null;
    }
    if (port) {
      await port.close();
      setPort(null);
    }
    setConnected(false);
    setStatus('Disconnected');
  };

  const readLoop = async () => {
    let buffer = '';
    while (keepReadingRef.current && readerRef.current) {
      try {
        const { value, done } = await readerRef.current.read();
        if (done) {
          break;
        }
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed) {
            handleGrblResponse(trimmed);
          }
        });
      } catch (err) {
        console.error('Read error:', err);
        break;
      }
    }
  };

  const handleGrblResponse = (line) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    // Parse status report like <Idle|MPos:0.000,0.000,0.000|FS:0,0>
    if (line.startsWith('<') && line.endsWith('>')) {
      const inner = line.slice(1, -1);
      const parts = inner.split('|');
      setStatus(parts[0]);
      
      for (const part of parts) {
        if (part.startsWith('MPos:') || part.startsWith('WPos:')) {
          const coords = part.substring(5).split(',');
          setPosition({
            x: parseFloat(coords[0]),
            y: parseFloat(coords[1]),
            z: parseFloat(coords[2])
          });
        }
      }
    } else {
        // Only log non-status responses to avoid spamming terminal
        setLogs(prev => [...prev.slice(-99), { time, type: 'response', msg: line }]);
    }
  };

  const sendCommand = async (cmd) => {
    const trimmed = cmd?.trim();
    if (!trimmed || !writerRef.current) return false;
    abortSendRef.current = false;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev.slice(-99), { time, type: 'command', msg: trimmed }]);
    await writerRef.current.write(trimmed + '\n');
    return true;
  };

  const sendRealtimeCommand = async (char) => {
    if (!writerRef.current) return false;
    await writerRef.current.write(char);
    return true;
  };

  const sendGCode = async (commands) => {
    abortSendRef.current = false;
    const commandList = Array.isArray(commands) ? commands : [commands];
    const validLines = commandList.filter(
      (line) => line.trim() && !line.trim().startsWith(';')
    );

    for (const line of validLines) {
      if (abortSendRef.current) {
        break;
      }
      await sendCommand(line.trim());
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const emergencyStop = async () => {
    abortSendRef.current = true;
    setLastEmergencyStopAt(Date.now());
    setStatus('Emergency Stop');

    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [
      ...prev.slice(-99),
      { time, type: 'response', msg: 'Emergency stop requested' },
    ]);

    if (!writerRef.current) return;

    try {
      await writerRef.current.write('!');
      await writerRef.current.write('\x18');
    } catch (err) {
      console.error('Emergency stop error:', err);
    }
  };

  // Poll for status
  useEffect(() => {
    let interval;
    if (connected) {
      interval = setInterval(() => {
        sendRealtimeCommand('?');
      }, 250); // 4Hz status update
    }
    return () => clearInterval(interval);
  }, [connected]);

  return {
    connected,
    connect,
    disconnect,
    logs,
    setLogs,
    sendCommand,
    sendRealtimeCommand,
    sendGCode,
    emergencyStop,
    lastEmergencyStopAt,
    position,
    status,
  };
}

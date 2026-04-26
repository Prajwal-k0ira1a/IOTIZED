import React, { useEffect, useMemo, useState } from "react";
import {
  Upload,
  Trash2,
  Eye,
  AlertCircle,
  Image as ImageIcon,
  Type,
  Pause,
  Play,
  SkipForward,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  PEN_DOWN_COMMAND,
  PEN_SERVO_SETTLE_COMMAND,
  PEN_UP_COMMAND,
} from "../constants/penControl";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const MAX_IMAGE_DIMENSION = 96;
const DARK_PIXEL_THRESHOLD = 160;
const RAPID_FEED = 3000;
const DRAW_FEED = 1200;
const DEFAULT_STEP_DELAY = 500;
const DRAWING_MODES = {
  image: {
    title: "Image Drawing",
    shortTitle: "Image",
    inputLabel: "Image Upload",
    emptyTitle: "No image drawings yet",
    emptyHint: "Upload a PNG, JPG, or JPEG file to convert it into G-code.",
    viewerHint: "Upload an image drawing to inspect the generated G-code.",
    previewLabel: "Uploaded Image",
  },
  text: {
    title: "Text Drawing",
    shortTitle: "Text",
    inputLabel: "Text Conversion",
    emptyTitle: "No text drawings yet",
    emptyHint: "Enter text, choose a font, and convert it into G-code.",
    viewerHint: "Convert a text drawing to inspect the generated G-code.",
    previewLabel: "Text Drawing",
  },
};

const isImageFile = (fileName) =>
  IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension));

const getCommandLines = (content) =>
  content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(";"));

const formatCoordinate = (value) => Number(value.toFixed(2));

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getCoordinateSpan = (min, max) => Math.abs(max - min);

const clampSize = (value, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
};

const buildOriginBounds = (coordinates, plotWidth, plotHeight) => {
  const xSpan = getCoordinateSpan(coordinates.xMin, coordinates.xMax);
  const ySpan = getCoordinateSpan(coordinates.yMin, coordinates.yMax);
  const safeWidth = clampSize(plotWidth, 1, xSpan);
  const safeHeight = clampSize(plotHeight, 1, ySpan);

  const xDirection = coordinates.xMax >= coordinates.xMin ? 1 : -1;
  const yDirection = coordinates.yMax >= coordinates.yMin ? 1 : -1;

  return {
    xMin: formatCoordinate(coordinates.xMin),
    xMax: formatCoordinate(coordinates.xMin + xDirection * safeWidth),
    yMin: formatCoordinate(coordinates.yMin),
    yMax: formatCoordinate(coordinates.yMin + yDirection * safeHeight),
    width: formatCoordinate(safeWidth),
    height: formatCoordinate(safeHeight),
  };
};

const loadImageElement = (source) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image"));
    image.src = source;
  });

const mapToRange = (value, maxValue, minCoordinate, maxCoordinate) => {
  if (maxValue <= 0) return formatCoordinate(minCoordinate);

  const ratio = value / maxValue;
  return formatCoordinate(
    minCoordinate + ratio * (maxCoordinate - minCoordinate),
  );
};

const readAxisValue = (line, axis, fallback) => {
  const match = line.match(new RegExp(`${axis}(-?\\d*\\.?\\d+)`, "i"));
  if (!match) return fallback;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseToolpath = (commandLines, coordinates) => {
  const startX = Number(coordinates?.xMin ?? 0);
  const startY = Number(coordinates?.yMin ?? 0);
  let currentX = startX;
  let currentY = startY;
  let penDown = false;
  const segments = [];
  const positionsByLine = [];

  commandLines.forEach((line, index) => {
    const normalized = line.trim().toUpperCase();

    if (normalized === PEN_DOWN_COMMAND.trim().toUpperCase()) {
      penDown = true;
      positionsByLine[index] = { x: currentX, y: currentY, penDown };
      return;
    }

    if (normalized === PEN_UP_COMMAND.trim().toUpperCase()) {
      penDown = false;
      positionsByLine[index] = { x: currentX, y: currentY, penDown };
      return;
    }

    if (!normalized.startsWith("G0") && !normalized.startsWith("G1")) {
      positionsByLine[index] = { x: currentX, y: currentY, penDown };
      return;
    }

    const nextX = readAxisValue(normalized, "X", currentX);
    const nextY = readAxisValue(normalized, "Y", currentY);

    if (nextX !== currentX || nextY !== currentY) {
      segments.push({
        startX: currentX,
        startY: currentY,
        endX: nextX,
        endY: nextY,
        kind: normalized.startsWith("G1") && penDown ? "draw" : "rapid",
        lineIndex: index,
      });
    }

    currentX = nextX;
    currentY = nextY;
    positionsByLine[index] = { x: currentX, y: currentY, penDown };
  });

  return {
    segments,
    positionsByLine,
    finalPosition: { x: currentX, y: currentY, penDown },
  };
};

const ToolpathPreview = ({
  coordinates,
  selectedFile,
  selectedCommands,
  currentStepIndex,
}) => {
  const machineBounds = useMemo(() => {
    const xMin = Math.min(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0);
    const xMax = Math.max(coordinates?.xMin ?? 0, coordinates?.xMax ?? 0);
    const yMin = Math.min(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0);
    const yMax = Math.max(coordinates?.yMin ?? 0, coordinates?.yMax ?? 0);
    return { xMin, xMax, yMin, yMax, width: xMax - xMin, height: yMax - yMin };
  }, [coordinates]);

  const previewData = useMemo(
    () => parseToolpath(selectedCommands, machineBounds),
    [machineBounds, selectedCommands],
  );

  const viewSize = 260;
  const padding = 18;
  const innerWidth = viewSize - padding * 2;
  const innerHeight = viewSize - padding * 2;
  const scale = Math.min(
    innerWidth / Math.max(machineBounds.width, 1),
    innerHeight / Math.max(machineBounds.height, 1),
  );
  const plotWidth = machineBounds.width * scale;
  const plotHeight = machineBounds.height * scale;
  const offsetX = padding + (innerWidth - plotWidth) / 2;
  const offsetY = padding + (innerHeight - plotHeight) / 2;

  const mapPoint = (x, y) => ({
    x: offsetX + (x - machineBounds.xMin) * scale,
    y: offsetY + plotHeight - (y - machineBounds.yMin) * scale,
  });

  const drawPath = previewData.segments
    .filter((segment) => segment.kind === "draw")
    .map((segment) => {
      const start = mapPoint(segment.startX, segment.startY);
      const end = mapPoint(segment.endX, segment.endY);
      return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    })
    .join(" ");

  const rapidPath = previewData.segments
    .filter((segment) => segment.kind === "rapid")
    .map((segment) => {
      const start = mapPoint(segment.startX, segment.startY);
      const end = mapPoint(segment.endX, segment.endY);
      return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    })
    .join(" ");

  const currentLineIndex =
    selectedCommands.length === 0
      ? -1
      : Math.min(currentStepIndex, selectedCommands.length - 1);
  const currentPosition =
    previewData.positionsByLine[currentLineIndex] ?? {
      x: machineBounds.xMin,
      y: machineBounds.yMin,
      penDown: false,
    };
  const currentPoint = mapPoint(currentPosition.x, currentPosition.y);
  const targetBounds = selectedFile?.actualBounds ?? selectedFile?.targetBounds;
  const targetRect = targetBounds
    ? (() => {
        const left = Math.min(targetBounds.xMin, targetBounds.xMax);
        const right = Math.max(targetBounds.xMin, targetBounds.xMax);
        const bottom = Math.min(targetBounds.yMin, targetBounds.yMax);
        const top = Math.max(targetBounds.yMin, targetBounds.yMax);
        const topLeft = mapPoint(left, top);
        const bottomRight = mapPoint(right, bottom);
        return {
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
        };
      })()
    : null;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-main)",
        border: "1px solid var(--border-color)",
        borderRadius: "4px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: "600",
          color: "var(--text-secondary)",
          marginBottom: "8px",
          textTransform: "uppercase",
        }}
      >
        Toolpath Visualizer
      </div>
      <div
        style={{
          background: "linear-gradient(180deg, #dbe6f3 0%, #cfdbec 100%)",
          borderRadius: "4px",
          border: "1px solid rgba(90, 110, 140, 0.35)",
          padding: "8px",
        }}
      >
        <svg
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          style={{ width: "100%", height: "220px", display: "block" }}
        >
          <rect
            x={offsetX}
            y={offsetY}
            width={plotWidth}
            height={plotHeight}
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(89, 108, 133, 0.4)"
          />
          {Array.from({ length: 15 }, (_, index) => {
            const x = offsetX + (plotWidth * index) / 14;
            const y = offsetY + (plotHeight * index) / 14;
            return (
              <React.Fragment key={`grid-${index}`}>
                <line x1={x} y1={offsetY} x2={x} y2={offsetY + plotHeight} stroke="rgba(98, 118, 146, 0.35)" strokeWidth="1" />
                <line x1={offsetX} y1={y} x2={offsetX + plotWidth} y2={y} stroke="rgba(98, 118, 146, 0.35)" strokeWidth="1" />
              </React.Fragment>
            );
          })}
          {targetRect && (
            <rect
              x={targetRect.x}
              y={targetRect.y}
              width={targetRect.width}
              height={targetRect.height}
              fill="rgba(0, 240, 255, 0.08)"
              stroke="rgba(0, 240, 255, 0.5)"
              strokeDasharray="4 4"
            />
          )}
          <line
            x1={offsetX}
            y1={offsetY + plotHeight}
            x2={offsetX + plotWidth}
            y2={offsetY + plotHeight}
            stroke="#ff3737"
            strokeWidth="2.5"
          />
          <line
            x1={offsetX}
            y1={offsetY}
            x2={offsetX}
            y2={offsetY + plotHeight}
            stroke="#3cc96b"
            strokeWidth="2.5"
          />
          {rapidPath && (
            <path
              d={rapidPath}
              fill="none"
              stroke="rgba(70, 125, 255, 0.65)"
              strokeWidth="1.25"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
          )}
          {drawPath && (
            <path
              d={drawPath}
              fill="none"
              stroke="#cf4f5e"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <circle cx={currentPoint.x} cy={currentPoint.y} r="6.5" fill="rgba(255, 229, 71, 0.45)" />
          <circle cx={currentPoint.x} cy={currentPoint.y} r="4" fill="#f7e548" stroke="#fff4b0" strokeWidth="1" />
        </svg>
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "0.68rem",
          color: "var(--text-secondary)",
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span>Draw segments: {previewData.segments.filter((segment) => segment.kind === "draw").length}</span>
        <span>Rapid moves: {previewData.segments.filter((segment) => segment.kind === "rapid").length}</span>
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "0.68rem",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <span>
          Position: X{currentPosition.x.toFixed(2)} Y{currentPosition.y.toFixed(2)}
        </span>
        <span>{currentPosition.penDown ? "Pen: DOWN" : "Pen: UP"}</span>
      </div>
    </div>
  );
};

const buildImageGCode = (imageData, width, height, bounds) => {
  const commands = [
    "; Generated from image upload",
    "G21 ; millimeters",
    "G90 ; absolute positioning",
    `; Bounds X${bounds.xMin}..X${bounds.xMax} Y${bounds.yMin}..Y${bounds.yMax}`,
    PEN_UP_COMMAND,
    PEN_SERVO_SETTLE_COMMAND,
    `G0 F${RAPID_FEED}`,
    `G1 F${DRAW_FEED}`,
  ];

  let minXPixel = width;
  let maxXPixel = -1;
  let minYPixel = height;
  let maxYPixel = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const alpha = imageData[pixelIndex + 3];
      const darkness =
        255 -
        (imageData[pixelIndex] * 0.299 +
          imageData[pixelIndex + 1] * 0.587 +
          imageData[pixelIndex + 2] * 0.114);

      if (!(alpha > 10 && darkness >= DARK_PIXEL_THRESHOLD)) continue;

      minXPixel = Math.min(minXPixel, x);
      maxXPixel = Math.max(maxXPixel, x);
      minYPixel = Math.min(minYPixel, y);
      maxYPixel = Math.max(maxYPixel, y);
    }
  }

  if (maxXPixel < 0 || maxYPixel < 0) {
    commands.push(
      `G0 X${formatCoordinate(bounds.xMin)} Y${formatCoordinate(bounds.yMin)}`,
    );
    commands.push(PEN_UP_COMMAND);
    commands.push(PEN_SERVO_SETTLE_COMMAND);

    return {
      content: commands.join("\n"),
      segments: 0,
      actualSize: {
        width: 0,
        height: 0,
      },
      actualBounds: {
        xMin: formatCoordinate(bounds.xMin),
        xMax: formatCoordinate(bounds.xMin),
        yMin: formatCoordinate(bounds.yMin),
        yMax: formatCoordinate(bounds.yMin),
      },
    };
  }

  const physXDir = bounds.xMax >= bounds.xMin ? 1 : -1;
  const physYDir = bounds.yMax >= bounds.yMin ? 1 : -1;

  const absWidth = Math.abs(bounds.xMax - bounds.xMin);
  const absHeight = Math.abs(bounds.yMax - bounds.yMin);

  const bboxW = Math.max(maxXPixel - minXPixel, 1);
  const bboxH = Math.max(maxYPixel - minYPixel, 1);

  const mmPerPixel = Math.min(absWidth / bboxW, absHeight / bboxH);

  const actualWidth = mmPerPixel * bboxW;
  const actualHeight = mmPerPixel * bboxH;

  const offsetX = bounds.xMin;
  const offsetY = bounds.yMin;

  const mapPixelX = (px) =>
    formatCoordinate(offsetX + physXDir * ((px - minXPixel) * mmPerPixel));
  const mapPixelY = (py) => {
    const relative = py - minYPixel;
    const normalized = physYDir >= 0 ? bboxH - relative : relative;
    return formatCoordinate(offsetY + physYDir * (normalized * mmPerPixel));
  };

  let segments = 0;

  for (let y = minYPixel; y <= maxYPixel; y += 1) {
    let x = 0;

    while (x < width) {
      const pixelIndex = (y * width + x) * 4;
      const alpha = imageData[pixelIndex + 3];
      const darkness =
        255 -
        (imageData[pixelIndex] * 0.299 +
          imageData[pixelIndex + 1] * 0.587 +
          imageData[pixelIndex + 2] * 0.114);

      if (!(alpha > 10 && darkness >= DARK_PIXEL_THRESHOLD)) {
        x += 1;
        continue;
      }

      if (x < minXPixel) {
        x = minXPixel;
        continue;
      }

      if (x > maxXPixel) break;

      const startX = x;
      let endX = x;

      while (endX + 1 < width && endX + 1 <= maxXPixel) {
        const nextPixelIndex = (y * width + (endX + 1)) * 4;
        const nextAlpha = imageData[nextPixelIndex + 3];
        const nextDarkness =
          255 -
          (imageData[nextPixelIndex] * 0.299 +
            imageData[nextPixelIndex + 1] * 0.587 +
            imageData[nextPixelIndex + 2] * 0.114);

        if (!(nextAlpha > 10 && nextDarkness >= DARK_PIXEL_THRESHOLD)) break;
        endX += 1;
      }

      const plotY = mapPixelY(y);
      const plotStartX = mapPixelX(startX);
      const plotEndX = mapPixelX(endX);

      commands.push(`G0 X${plotStartX} Y${plotY}`);
      commands.push(PEN_DOWN_COMMAND);
      commands.push(PEN_SERVO_SETTLE_COMMAND);
      commands.push(`G1 X${plotEndX} Y${plotY}`);
      commands.push(PEN_UP_COMMAND);
      commands.push(PEN_SERVO_SETTLE_COMMAND);
      segments += 1;
      x = endX + 1;
    }
  }

  commands.push(`G0 X${formatCoordinate(bounds.xMin)} Y${formatCoordinate(bounds.yMin)}`);
  commands.push(PEN_UP_COMMAND);
  commands.push(PEN_SERVO_SETTLE_COMMAND);

  return {
    content: commands.join("\n"),
    segments,
    actualSize: {
      width: formatCoordinate(actualWidth),
      height: formatCoordinate(actualHeight),
    },
    actualBounds: {
      xMin: formatCoordinate(offsetX),
      xMax: formatCoordinate(offsetX + physXDir * actualWidth),
      yMin: formatCoordinate(offsetY),
      yMax: formatCoordinate(offsetY + physYDir * actualHeight),
    },
  };
};

const convertImageToGCode = async (file, bounds) => {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result);
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });

  if (typeof dataUrl !== "string") {
    throw new Error("Image data was not readable");
  }

  const image = await loadImageElement(dataUrl);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.width, image.height),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas preview is not available");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const { content, segments, actualSize, actualBounds } = buildImageGCode(
    data,
    width,
    height,
    bounds,
  );

  return {
    content,
    previewUrl: dataUrl,
    dimensions: { width, height },
    segments,
    targetBounds: bounds,
    actualSize,
    actualBounds,
  };
};

const convertTextToGCode = async (text, fontStyle, bounds) => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 400;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  
  if (!context) {
    throw new Error("Canvas preview is not available");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.fillStyle = "#000000";
  context.font = fontStyle;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const dataUrl = canvas.toDataURL("image/png");
  const image = await loadImageElement(dataUrl);

  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.width, image.height),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const processCanvas = document.createElement("canvas");
  processCanvas.width = width;
  processCanvas.height = height;

  const processContext = processCanvas.getContext("2d", { willReadFrequently: true });
  if (!processContext) {
    throw new Error("Canvas preview is not available");
  }

  processContext.fillStyle = "#ffffff";
  processContext.fillRect(0, 0, width, height);
  processContext.drawImage(image, 0, 0, width, height);

  const { data } = processContext.getImageData(0, 0, width, height);
  const { content, segments, actualSize, actualBounds } = buildImageGCode(
    data,
    width,
    height,
    bounds,
  );

  return {
    content,
    previewUrl: dataUrl,
    dimensions: { width, height },
    segments,
    targetBounds: bounds,
    actualSize,
    actualBounds,
  };
};

const FilesView = ({ esp32, coordinates, navMode = "image" }) => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeDrawMode, setActiveDrawMode] = useState("image");
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [stepDelay, setStepDelay] = useState(DEFAULT_STEP_DELAY);
  const [isSendingStep, setIsSendingStep] = useState(false);
  const [isGcodeViewerExpanded, setIsGcodeViewerExpanded] = useState(true);
  const workspaceWidth = useMemo(
    () => getCoordinateSpan(coordinates.xMin, coordinates.xMax),
    [coordinates.xMax, coordinates.xMin],
  );
  const workspaceHeight = useMemo(
    () => getCoordinateSpan(coordinates.yMin, coordinates.yMax),
    [coordinates.yMax, coordinates.yMin],
  );
  const [plotSize, setPlotSize] = useState({
    width: workspaceWidth,
    height: workspaceHeight,
  });

  const [textInput, setTextInput] = useState("");
  const [fontFamily, setFontFamily] = useState("Arial");

  const selectedCommands = useMemo(
    () => (selectedFile ? getCommandLines(selectedFile.content) : []),
    [selectedFile],
  );
  const activeModeConfig = DRAWING_MODES[activeDrawMode];
  const visibleFiles = useMemo(
    () => files.filter((file) => file.type === activeDrawMode),
    [activeDrawMode, files],
  );
  const selectedTargetBounds = useMemo(
    () => buildOriginBounds(coordinates, plotSize.width, plotSize.height),
    [coordinates, plotSize.height, plotSize.width],
  );
  const selectedPreviewWidth = Math.max(
    8,
    (selectedTargetBounds.width / Math.max(workspaceWidth, 1)) * 100,
  );
  const selectedPreviewHeight = Math.max(
    8,
    (selectedTargetBounds.height / Math.max(workspaceHeight, 1)) * 100,
  );

  useEffect(() => {
    setActiveDrawMode(navMode === "text" ? "text" : "image");
  }, [navMode]);

  useEffect(() => {
    setCurrentStepIndex(0);
    setIsRunning(false);
    setIsSendingStep(false);
  }, [selectedFile?.id]);

  useEffect(() => {
    if (!selectedFile) {
      if (visibleFiles.length > 0) {
        setSelectedFile(visibleFiles[0]);
      }
      return;
    }

    if (selectedFile.type !== activeDrawMode) {
      setSelectedFile(visibleFiles[0] ?? null);
    }
  }, [activeDrawMode, selectedFile, visibleFiles]);

  useEffect(() => {
    if (!esp32?.lastEmergencyStopAt) return;

    setIsRunning(false);
    setIsSendingStep(false);
    setStatusMessage(
      "Emergency stop triggered. Plot execution was halted immediately.",
    );
  }, [esp32?.lastEmergencyStopAt]);

  useEffect(() => {
    setPlotSize({
      width: workspaceWidth,
      height: workspaceHeight,
    });
  }, [workspaceHeight, workspaceWidth]);

  const sendCommandLine = async (line) => {
    if (typeof esp32?.sendCommand === "function") {
      await esp32.sendCommand(line);
      return;
    }

    if (typeof esp32?.sendGCode === "function") {
      await esp32.sendGCode([line]);
      return;
    }

    throw new Error("Connected controller cannot send G-code commands");
  };

  const sendSingleStep = async () => {
    if (!esp32?.connected) {
      alert("Connect to the plotter first.");
      return false;
    }

    if (!selectedFile) {
      alert("Select a converted file first.");
      return false;
    }

    if (currentStepIndex >= selectedCommands.length) {
      setStatusMessage("All G-code steps have already been executed.");
      return false;
    }

    const line = selectedCommands[currentStepIndex];

    try {
      setIsSendingStep(true);
      setStatusMessage(
        `Sending step ${currentStepIndex + 1} of ${selectedCommands.length}: ${line}`,
      );
      await sendCommandLine(line);
      setCurrentStepIndex((previous) => previous + 1);
      setStatusMessage(
        `Step ${currentStepIndex + 1} sent. Observe the plotter, then continue.`,
      );
      return true;
    } catch (error) {
      setIsRunning(false);
      setStatusMessage(error.message || "Failed to send step.");
      return false;
    } finally {
      setIsSendingStep(false);
    }
  };

  useEffect(() => {
    if (!isRunning || isSendingStep || !selectedFile) return undefined;

    if (currentStepIndex >= selectedCommands.length) {
      setIsRunning(false);
      setStatusMessage("Step-by-step execution complete.");
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      const sent = await sendSingleStep();
      if (!sent) {
        setIsRunning(false);
      }
    }, stepDelay);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentStepIndex,
    isRunning,
    isSendingStep,
    selectedCommands.length,
    selectedFile,
    stepDelay,
  ]);

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const input = event.target;
    const fileName = file.name.toLowerCase();

    if (!isImageFile(fileName)) {
      alert("Only .png, .jpg, and .jpeg image files are allowed.");
      input.value = "";
      return;
    }

    setIsUploading(true);
    setStatusMessage("Converting image to G-code...");

    convertImageToGCode(file, selectedTargetBounds)
      .then((conversion) => {
        const newFile = {
          id: Date.now(),
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toLocaleString(),
          content: conversion.content,
          lines: getCommandLines(conversion.content).length,
          previewUrl: conversion.previewUrl,
          imageDimensions: conversion.dimensions,
          drawSegments: conversion.segments,
          targetBounds: conversion.targetBounds,
          actualPlotSize: conversion.actualSize,
          actualBounds: conversion.actualBounds,
          type: "image",
        };

        setFiles((previous) => [newFile, ...previous]);
        setSelectedFile(newFile);
        setStatusMessage(
          "Image converted to G-code successfully using the selected plot size.",
        );
      })
      .catch((error) => {
        alert(error.message || "Image conversion failed");
        setStatusMessage("Image conversion failed.");
      })
      .finally(() => {
        setIsUploading(false);
        input.value = "";
      });
  };

  const handleTextConvert = () => {
    if (!textInput.trim()) {
      alert("Please enter some text.");
      return;
    }

    setIsUploading(true);
    setStatusMessage("Converting text to G-code...");

    convertTextToGCode(
      textInput,
      `bold 100px ${fontFamily}`,
      selectedTargetBounds,
    )
      .then((conversion) => {
        const newFile = {
          id: Date.now(),
          name: `Text: ${textInput}`,
          size: conversion.content.length,
          uploadedAt: new Date().toLocaleString(),
          content: conversion.content,
          lines: getCommandLines(conversion.content).length,
          previewUrl: conversion.previewUrl,
          imageDimensions: conversion.dimensions,
          drawSegments: conversion.segments,
          targetBounds: conversion.targetBounds,
          actualPlotSize: conversion.actualSize,
          actualBounds: conversion.actualBounds,
          type: "text",
        };

        setFiles((previous) => [newFile, ...previous]);
        setSelectedFile(newFile);
        setStatusMessage(
          "Text converted to G-code successfully using the selected plot size.",
        );
        setTextInput("");
      })
      .catch((error) => {
        alert(error.message || "Text conversion failed");
        setStatusMessage("Text conversion failed.");
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  const handleDeleteFile = (fileId) => {
    if (!window.confirm("Delete this converted file?")) return;

    setFiles((previous) => previous.filter((file) => file.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
    }
  };

  const handleRunAll = async () => {
    if (!esp32?.connected) {
      alert("Connect to the plotter first.");
      return;
    }

    if (!selectedFile) {
      alert("Select a converted file first.");
      return;
    }

    if (selectedCommands.length === 0) {
      alert("No valid G-code was generated.");
      return;
    }

    if (currentStepIndex >= selectedCommands.length) {
      if (
        window.confirm(
          "This file has already finished running. Restart from the first command?",
        )
      ) {
        setCurrentStepIndex(0);
      } else {
        return;
      }
    }

    setStatusMessage(
      "Automatic step-by-step execution started. Watch the plotter while it runs.",
    );
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    setStatusMessage("Execution paused. You can inspect and continue manually.");
  };

  const handleResetSteps = () => {
    setIsRunning(false);
    setCurrentStepIndex(0);
    setStatusMessage("Execution reset to the first G-code line.");
  };

  const updatePlotSize = (field, value) => {
    setPlotSize((previous) => ({
      ...previous,
      [field]: clampSize(
        value,
        1,
        field === "width" ? workspaceWidth : workspaceHeight,
      ),
    }));
  };

  const progressPercent =
    selectedCommands.length === 0
      ? 0
      : Math.round((currentStepIndex / selectedCommands.length) * 100);
  const imageFileCount = files.filter((file) => file.type === "image").length;
  const textFileCount = files.filter((file) => file.type === "text").length;
  const isImageMode = activeDrawMode === "image";
  const activeModeCount = isImageMode ? imageFileCount : textFileCount;
  const ActiveModeIcon = isImageMode ? ImageIcon : Type;
  const modeCardStyle = {
    backgroundColor: "rgba(0, 240, 255, 0.08)",
    border: "1px solid var(--accent-cyan)",
    borderRadius: "6px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  };
  const controlFieldStyle = {
    width: "100%",
    padding: "10px 12px",
    backgroundColor: "var(--bg-main)",
    border: "1px solid var(--border-color)",
    borderRadius: "4px",
    color: "var(--text-primary)",
    boxSizing: "border-box",
  };
  const quietButtonStyle = {
    padding: "10px 16px",
    backgroundColor: "var(--bg-main)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
    borderRadius: "4px",
    fontWeight: "600",
    whiteSpace: "nowrap",
  };

  return (
    <div className="fv-root">
      <div className="page-header">
        <div>
          <div className="page-title">{activeModeConfig.title}</div>
          <div className="breadcrumbs">
            {activeModeConfig.inputLabel} <span>&gt;</span> Review_GCode{" "}
            <span>&gt;</span> Step_Run
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {statusMessage && (
            <div className="fv-status-msg">{statusMessage}</div>
          )}
        </div>
      </div>

      <div className="fv-body">
        <div className="fv-left">
          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: "12px",
                padding: "12px 16px",
                backgroundColor: "var(--bg-main)",
                borderBottom: "1px solid var(--border-color)",
                fontSize: "0.7rem",
                fontWeight: "600",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
              }}
            >
              <div>{activeModeConfig.shortTitle} File</div>
              <div>Size</div>
              <div>G-code Lines</div>
              <div>Actions</div>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {visibleFiles.length === 0 ? (
                <div
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  {activeDrawMode === "image" ? (
                    <ImageIcon
                      size={32}
                      style={{ opacity: 0.3, marginBottom: "12px" }}
                    />
                  ) : (
                    <Type
                      size={32}
                      style={{ opacity: 0.3, marginBottom: "12px" }}
                    />
                  )}
                  <div style={{ fontSize: "0.85rem" }}>
                    {activeModeConfig.emptyTitle}
                  </div>
                  <div style={{ fontSize: "0.75rem", marginTop: "8px" }}>
                    {activeModeConfig.emptyHint}
                  </div>
                </div>
              ) : (
                visibleFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr",
                      gap: "12px",
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-color)",
                      cursor: "pointer",
                      backgroundColor:
                        selectedFile?.id === file.id
                          ? "rgba(0, 240, 255, 0.05)"
                          : "transparent",
                      borderLeft:
                        selectedFile?.id === file.id
                          ? "3px solid var(--accent-cyan)"
                          : "3px solid transparent",
                      transition: "all 0.2s",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem" }}>
                      <div
                        style={{
                          fontWeight: "500",
                          marginBottom: "4px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {file.type === "image" ? (
                          <ImageIcon size={14} />
                        ) : (
                          <Type size={14} />
                        )}
                        {file.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {file.uploadedAt}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--accent-cyan)",
                      }}
                    >
                      {formatFileSize(file.size)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--accent-yellow)",
                      }}
                    >
                      {file.lines}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setSelectedFile(file);
                        }}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "transparent",
                          border: "1px solid var(--border-color)",
                          borderRadius: "3px",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: "0.65rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Preview"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          handleDeleteFile(file.id);
                        }}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "rgba(211, 26, 31, 0.1)",
                          border: "1px solid var(--accent-red)",
                          borderRadius: "3px",
                          color: "var(--accent-red)",
                          cursor: "pointer",
                          fontSize: "0.65rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                }}
              >
                Full G-code Viewer
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={() => setIsGcodeViewerExpanded((previous) => !previous)}
                  style={{
                    padding: "4px 8px",
                    backgroundColor: "transparent",
                    border: "1px solid var(--border-color)",
                    borderRadius: "3px",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.65rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title={isGcodeViewerExpanded ? "Collapse" : "Expand"}
                >
                  {isGcodeViewerExpanded ? (
                    <>
                      <ChevronUp size={12} /> Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown size={12} /> Show
                    </>
                  )}
                </button>
                {selectedFile && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedFile.content);
                      setStatusMessage("G-code copied to clipboard.");
                    }}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "transparent",
                      border: "1px solid var(--border-color)",
                      borderRadius: "3px",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.65rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    title="Copy G-code"
                  >
                    <Copy size={12} /> Copy
                  </button>
                )}
                {selectedFile && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Step {Math.min(currentStepIndex + 1, selectedCommands.length || 1)}
                    /{selectedCommands.length || 0}
                  </div>
                )}
              </div>
            </div>
            {isGcodeViewerExpanded && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "10px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.7rem",
                }}
              >
                {selectedFile ? (
                  selectedCommands.map((line, index) => {
                    const isCurrent = index === currentStepIndex;
                    const isDone = index < currentStepIndex;

                    return (
                      <div
                        key={`${selectedFile.id}-${index}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "56px 1fr",
                          gap: "12px",
                          padding: "4px 16px",
                          backgroundColor: isCurrent
                            ? "rgba(0, 240, 255, 0.08)"
                            : "transparent",
                          borderLeft: isCurrent
                            ? "3px solid var(--accent-cyan)"
                            : "3px solid transparent",
                          color: isDone
                            ? "var(--text-muted)"
                            : isCurrent
                              ? "var(--accent-cyan)"
                              : "white",
                        }}
                      >
                        <div style={{ opacity: 0.7 }}>{index + 1}</div>
                        <div style={{ wordBreak: "break-word" }}>{line}</div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    {activeModeConfig.viewerHint}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedFile && (
            <ToolpathPreview
              coordinates={coordinates}
              selectedFile={selectedFile}
              selectedCommands={selectedCommands}
              currentStepIndex={currentStepIndex}
            />
          )}
        </div>

        <div
          style={{
            width: "380px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={modeCardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                <ActiveModeIcon size={18} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: "600" }}>
                    {isImageMode ? "Image Drawing" : "Text Drawing"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {isImageMode
                      ? "Upload and convert raster artwork into plot-ready G-code."
                      : "Type a label or phrase, then convert it with its own settings."}
                  </div>
                </div>
              </div>
              <div
                style={{
                  minWidth: "32px",
                  padding: "4px 8px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(0, 240, 255, 0.12)",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-cyan)",
                  textAlign: "center",
                }}
              >
                {activeModeCount}
              </div>
            </div>

            {isImageMode ? (
              <label
                style={{
                  padding: "10px 14px",
                  backgroundColor: "var(--accent-cyan)",
                  color: "black",
                  borderRadius: "4px",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  opacity: isUploading ? 0.7 : 1,
                }}
              >
                <Upload size={14} /> Upload Image
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  style={{ display: "none" }}
                  disabled={isUploading}
                />
              </label>
            ) : (
              <>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                    }}
                  >
                    Plot Text
                  </div>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(event) => setTextInput(event.target.value)}
                    placeholder="Enter text to plot..."
                    disabled={isUploading}
                    style={controlFieldStyle}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: "10px",
                    alignItems: "end",
                  }}
                >
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                      }}
                    >
                      Font
                    </div>
                    <select
                      value={fontFamily}
                      onChange={(event) => setFontFamily(event.target.value)}
                      disabled={isUploading}
                      style={{ ...controlFieldStyle, minWidth: 0 }}
                    >
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                  </div>
                  <button
                    onClick={handleTextConvert}
                    disabled={isUploading || !textInput.trim()}
                    style={{
                      ...quietButtonStyle,
                      cursor:
                        isUploading || !textInput.trim() ? "not-allowed" : "pointer",
                      opacity: isUploading || !textInput.trim() ? 0.5 : 1,
                    }}
                  >
                    Convert Text
                  </button>
                </div>
              </>
            )}
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: "600",
                  color: "white",
                }}
              >
                Plot Size
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                Choose the drawing size inside the full machine area before conversion.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Width (max {workspaceWidth.toFixed(2)})
                </div>
                <input
                  type="number"
                  min="1"
                  max={workspaceWidth}
                  step="0.5"
                  value={plotSize.width}
                  onChange={(event) => updatePlotSize("width", event.target.value)}
                  disabled={isUploading}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    backgroundColor: "var(--bg-main)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    color: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Height (max {workspaceHeight.toFixed(2)})
                </div>
                <input
                  type="number"
                  min="1"
                  max={workspaceHeight}
                  step="0.5"
                  value={plotSize.height}
                  onChange={(event) => updatePlotSize("height", event.target.value)}
                  disabled={isUploading}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    backgroundColor: "var(--bg-main)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    color: "white",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Target box: X{selectedTargetBounds.xMin}..{selectedTargetBounds.xMax} Y
              {selectedTargetBounds.yMin}..{selectedTargetBounds.yMax}
            </div>

            <div
              style={{
                backgroundColor: "var(--bg-main)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: "600",
                  color: "var(--text-secondary)",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                }}
              >
                Size Visualization
              </div>
              <div
                style={{
                  height: "160px",
                  borderRadius: "6px",
                  border: "1px dashed rgba(255,255,255,0.16)",
                  position: "relative",
                  background:
                    "linear-gradient(180deg, rgba(0,240,255,0.03), rgba(255,255,255,0.01))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${selectedPreviewWidth}%`,
                    height: `${selectedPreviewHeight}%`,
                    border: "2px solid var(--accent-cyan)",
                    borderRadius: "4px",
                    backgroundColor: "rgba(0, 240, 255, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent-cyan)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.72rem",
                    textAlign: "center",
                    padding: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  {selectedTargetBounds.width} x {selectedTargetBounds.height}
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    fontSize: "0.65rem",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Full area: {workspaceWidth.toFixed(2)} x {workspaceHeight.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              minHeight: 0,
            }}
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: "600",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
              }}
            >
              Conversion Preview
            </div>

            {selectedFile ? (
              <>
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "var(--bg-main)",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    {activeModeConfig.previewLabel}
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontFamily: "var(--font-mono)",
                      wordBreak: "break-all",
                      color: "var(--accent-cyan)",
                      marginBottom: "12px",
                    }}
                  >
                    {selectedFile.name}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Size
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--accent-peach)",
                        }}
                      >
                        {formatFileSize(selectedFile.size)}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Commands
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--accent-yellow)",
                        }}
                      >
                        {selectedCommands.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--bg-main)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: "600",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                    }}
                  >
                    Execution Controls
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Completed
                      </div>
                      <div
                        style={{
                          fontSize: "1rem",
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-cyan)",
                        }}
                      >
                        {currentStepIndex}/{selectedCommands.length}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Progress
                      </div>
                      <div
                        style={{
                          fontSize: "1rem",
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-yellow)",
                        }}
                      >
                        {progressPercent}%
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      borderRadius: "999px",
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        height: "100%",
                        backgroundColor: "var(--accent-cyan)",
                        transition: "width 0.2s ease",
                      }}
                    ></div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--text-secondary)",
                        marginBottom: "6px",
                      }}
                    >
                      Auto step delay
                    </div>
                    <input
                      type="range"
                      min="150"
                      max="2000"
                      step="50"
                      value={stepDelay}
                      onChange={(event) => setStepDelay(Number(event.target.value))}
                      disabled={isRunning}
                      style={{ width: "100%" }}
                    />
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {stepDelay} ms between commands
                    </div>
                  </div>

                  <button
                    onClick={sendSingleStep}
                    disabled={
                      !esp32?.connected ||
                      !selectedFile ||
                      isSendingStep ||
                      currentStepIndex >= selectedCommands.length
                    }
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "var(--accent-peach)",
                      color: "black",
                      border: "none",
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "0.75rem",
                      cursor:
                        !esp32?.connected ||
                        !selectedFile ||
                        isSendingStep ||
                        currentStepIndex >= selectedCommands.length
                          ? "not-allowed"
                          : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      opacity:
                        !esp32?.connected ||
                        !selectedFile ||
                        isSendingStep ||
                        currentStepIndex >= selectedCommands.length
                          ? 0.5
                          : 1,
                    }}
                  >
                    <SkipForward size={16} /> Send Next Step
                  </button>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={handleRunAll}
                      disabled={
                        !esp32?.connected ||
                        !selectedFile ||
                        isSendingStep ||
                        isRunning
                      }
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        backgroundColor: "var(--accent-cyan)",
                        color: "black",
                        border: "none",
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "0.75rem",
                        cursor:
                          !esp32?.connected ||
                          !selectedFile ||
                          isSendingStep ||
                          isRunning
                            ? "not-allowed"
                            : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        opacity:
                          !esp32?.connected ||
                          !selectedFile ||
                          isSendingStep ||
                          isRunning
                            ? 0.5
                            : 1,
                      }}
                    >
                      <Play size={16} /> Run
                    </button>
                    <button
                      onClick={handlePause}
                      disabled={!isRunning}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        backgroundColor: "var(--bg-panel)",
                        color: "white",
                        border: "1px solid var(--border-color)",
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "0.75rem",
                        cursor: !isRunning ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        opacity: !isRunning ? 0.5 : 1,
                      }}
                    >
                      <Pause size={16} /> Pause
                    </button>
                  </div>

                  <button
                    onClick={handleResetSteps}
                    disabled={!selectedFile}
                    style={{
                      padding: "10px 14px",
                      backgroundColor: "transparent",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "0.75rem",
                      cursor: !selectedFile ? "not-allowed" : "pointer",
                      opacity: !selectedFile ? 0.5 : 1,
                    }}
                  >
                    Reset Step Counter
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                {activeDrawMode === "image" ? (
                  <ImageIcon
                    size={24}
                    style={{ opacity: 0.3, marginBottom: "12px" }}
                  />
                ) : (
                  <Type
                    size={24}
                    style={{ opacity: 0.3, marginBottom: "12px" }}
                  />
                )}
                <div style={{ fontSize: "0.75rem" }}>
                  {activeModeConfig.viewerHint}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "rgba(255, 193, 7, 0.08)",
              border: "1px solid rgba(255, 193, 7, 0.4)",
              borderRadius: "4px",
              fontSize: "0.7rem",
              color: "var(--text-secondary)",
            }}
          >
            Review the generated G-code first, then use `Send Next Step` for
            manual observation or `Run` for timed step-by-step playback. New
            plots are scaled into X{coordinates.xMin}..{coordinates.xMax} and
            Y{coordinates.yMin}..{coordinates.yMax}.
          </div>

          <div
            style={{
              padding: "12px 16px",
              backgroundColor: esp32?.connected
                ? "rgba(0, 240, 255, 0.1)"
                : "rgba(211, 26, 31, 0.1)",
              border: `1px solid ${esp32?.connected ? "var(--accent-cyan)" : "var(--accent-red)"}`,
              borderRadius: "4px",
              display: "flex",
              gap: "8px",
            }}
          >
            <AlertCircle
              size={16}
              style={{
                color: esp32?.connected
                  ? "var(--accent-cyan)"
                  : "var(--accent-red)",
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
              {esp32?.connected ? (
                <>
                  <div style={{ fontWeight: "600" }}>Plotter Connected</div>
                  <div>{esp32?.status}</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: "600" }}>Plotter Disconnected</div>
                  <div>Connect first, then review and execute the G-code.</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilesView;

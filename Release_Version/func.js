const getBase85DecodeValue = (code) => {
    if (code === 0x28) code = 0x3c;
    if (code === 0x29) code = 0x3e;
    return code - 0x2a;
  };
  const base85decode = (str, outBuffer, outOffset) => {
    const view = new DataView(outBuffer, outOffset, Math.floor(str.length / 5 * 4));
    for (let i = 0, j = 0; i < str.length; i += 5, j += 4) {
      view.setUint32(j, (
        getBase85DecodeValue(str.charCodeAt(i + 4)) * 85 * 85 * 85 * 85 +
        getBase85DecodeValue(str.charCodeAt(i + 3)) * 85 * 85 * 85 +
        getBase85DecodeValue(str.charCodeAt(i + 2)) * 85 * 85 +
        getBase85DecodeValue(str.charCodeAt(i + 1)) * 85 +
        getBase85DecodeValue(str.charCodeAt(i))
      ), true);
    }
  };
  let projectDecodeBuffer = new ArrayBuffer(5834044);
  let projectDecodeIndex = 0;
  const decodeChunk = (size) => {
    try {
      base85decode(document.currentScript.getAttribute("data"), projectDecodeBuffer, projectDecodeIndex);
      document.currentScript.remove();
      projectDecodeIndex += size;
      setProgress(interpolate(0.1, 0.75, projectDecodeIndex / 5834043));
    } catch (e) {
      handleError(e);
    }
  };
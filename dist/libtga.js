(function(root, undefined) {

  "use strict";


/* libtga main */

var XMLHttpRequest = root.XMLHttpRequest || null;

// constants and such:
var HEADER_SIZE = 18,

  // image types: is bitfield-ish
  IMAGE_TYPE_NONE = 0|0,
  IMAGE_TYPE_COLORMAPPED = 1|0,
  IMAGE_TYPE_TRUECOLOR = 2|0,
  IMAGE_TYPE_GREYSCALE = 3|0,

  // compression flag:
  IMAGE_RUNLENGTH_ENCODED = 0x8|0,

  // color maps (documented on wikipedia, but not in the spec?):
  /*COLOR_MAP_NONE = 0|0,
  COLOR_MAP_EXISTS = 1|0,
  COLOR_MAP_TRUEVISION_START = 2|0,
  COLOR_MAP_TRUEVISION_END = 127|0,
  COLOR_MAP_DEV_START = 128|0,
  COLOR_MAP_DEV_END = 255|0,*/

  // image descriptor constants:
  IMAGE_DESCRIPTOR_ATTRIBUTE_MASK = 0xf,
  IMAGE_DESCRIPTOR_ORIGIN_MASK = 0x30,
  IMAGE_DESCRIPTOR_INTERLEAVE_MASK = 0xc0,

  // Origin values:
  IMAGE_ORIGIN_VERTICAL_MASK = 0x02,
  IMAGE_ORIGIN_HORIZONTAL_MASK = 0x01,
  IMAGE_ORIGIN_TOP = 0x02,
  IMAGE_ORIGIN_RIGHT = 0x01;

var TGA = function(arraybuf)
{
  this.dataview = new DataView(arraybuf);
  this.header = TGA.readHeader(this.dataview);
  this.width = this.header.imageSpec.width;
  this.height = this.header.imageSpec.height;
  this.compressed = !!(this.header.imageType & IMAGE_RUNLENGTH_ENCODED);
  this.imageId = TGA.readImageId(this.dataview, this.header);
  this.colorMap = TGA.readColorMap(this.dataview, this.header);
  this.imageData = TGA.readImage(this);
};

// add constant refs here:
TGA.HEADER_SIZE = HEADER_SIZE;
TGA.IMAGE_TYPE_NONE = IMAGE_TYPE_NONE;
TGA.IMAGE_TYPE_COLORMAPPED = IMAGE_TYPE_COLORMAPPED;
TGA.IMAGE_TYPE_TRUECOLOR = IMAGE_TYPE_TRUECOLOR;
TGA.IMAGE_TYPE_GREYSCALE = IMAGE_TYPE_GREYSCALE;
TGA.IMAGE_RUNLENGTH_ENCODED = IMAGE_RUNLENGTH_ENCODED;

// Utility functions don't really need to be in the prototype?
// Utility functions:
TGA.readHeader = function(dataview)
{
  var header = {
    idLength: dataview.getUint8(0, true),
    mapType: dataview.getUint8(1, true),
    imageType: dataview.getUint8(2, true),
    colorMapSpec: TGA.readColorMapSpec(dataview, 3),
    imageSpec: TGA.readImageSpec(dataview, 8)
  };
  return header;
};

TGA.readColorMapSpec = function(dataview, offset)
{
  var bits = dataview.getUint8(offset+4, true);
  var colorMapSpec = {
    firstEntry: dataview.getUint16(offset, true),
    length: dataview.getUint16(offset+2, true),
    entrySizeBits: bits,
    entrySizeBytes: Math.floor((bits + 7) / 8)
  };
  return colorMapSpec;
};

TGA.readImageSpec = function(dataview, offset)
{
  var descriptor = dataview.getUint8(offset+9);
  var imageSpec = {
    xOrigin: dataview.getUint16(offset, true),
    yOrigin: dataview.getUint16(offset+2, true),
    width: dataview.getUint16(offset+4, true),
    height: dataview.getUint16(offset+6, true),
    pixelDepth: dataview.getUint8(offset+8),
    descriptor: descriptor,
    attributeBits: descriptor & IMAGE_DESCRIPTOR_ATTRIBUTE_MASK,
    origin: (descriptor & IMAGE_DESCRIPTOR_ORIGIN_MASK) >> 4,
    interleave: (descriptor & IMAGE_DESCRIPTOR_INTERLEAVE_MASK) >> 6
  };
  return imageSpec;
};

TGA.readImageId = function(dataview, header)
{
  return new Uint8Array(dataview.buffer, HEADER_SIZE, header.idLength);
};

TGA.readColorMap = function(dataview, header)
{
  if(header.colorMapSpec.length <= 0)
  {
    return null;
  }
  var colorMap = new Uint8ClampedArray(header.colorMapSpec.length * 4),
    read = null,
    offset = HEADER_SIZE + header.idLength;

  switch(header.colorMapSpec.entrySizeBits) {
    case 8:
      read = TGA.readPixel8;
      break;
    case 16:
      read = TGA.readPixel15;
      break;
    case 15:
      read = TGA.readPixel16;
      break;
    case 24:
      read = TGA.readPixel24;
      break;
    case 32:
      read = TGA.readPixel32;
      break;
    default:
      throw 'Unsupported pixel depth';
  }

  for(var i = 0; i < header.colorMapSpec.length; i++)
  {
    read(dataview, offset, i, colorMap, i);
  }

  return colorMap;
};

TGA.readPixel8 = function(input, offset, i, output, j)
{
  var byte = input.getUint8(offset + i);
  output[j * 4 + 2] = byte; // blue
  output[j * 4 + 1] = byte; // green
  output[j * 4 + 0] = byte; // red
  output[j * 4 + 3] = 255; // alpha
};

TGA.readPixel15 = function(input, offset, i, output, j)
{
  var chunk = input.getUint16(offset + (i * 2), true);
  output[j * 4 + 2] = (chunk & 0x1f) << 3; // blue
  output[j * 4 + 1] = ((chunk >> 5) & 0x1f) << 3; // green
  output[j * 4 + 0] = ((chunk >> 10) & 0x1f) << 3; // red
  output[j * 4 + 3] = 255; // alpha
};

TGA.readPixel16 = function(input, offset, i, output, j)
{
  var chunk = input.getUint16(offset + (i * 2), true);
  output[j * 4 + 2] = (chunk & 0x1f) << 3; // blue
  output[j * 4 + 1] = ((chunk >> 5) & 0x1f) << 3; // green
  output[j * 4 + 0] = ((chunk >> 10) & 0x1f) << 3; // red
  output[j * 4 + 3] = (chunk & 0x80) == 0x80 ? 255 : 0; // alpha
};

TGA.readPixel24 = function(input, offset, i, output, j)
{
  output[j * 4 + 2] = input.getUint8(offset + (i * 3) + 0); //blue
  output[j * 4 + 1] = input.getUint8(offset + (i * 3) + 1); //green
  output[j * 4 + 0] = input.getUint8(offset + (i * 3) + 2); //red
  output[j * 4 + 3] = 255;
};

TGA.readPixel32 = function(input, offset, i, output, j)
{
  output[j * 4 + 2] = input.getUint8(offset + (i * 4) + 0); //blue
  output[j * 4 + 1] = input.getUint8(offset + (i * 4) + 1); //green
  output[j * 4 + 0] = input.getUint8(offset + (i * 4) + 2); //red
  output[j * 4 + 3] = 255;//input.getUint8(offset + (i * 4) + 3); // alpha
};

TGA.readMappedPixel8 = function(input, map, mapOffset, offset, i, output, j)
{
  var index = input.getUint8(offset + i) + mapOffset;
  output[j * 4 + 0] = map[index * 4 + 0]; // blue
  output[j * 4 + 1] = map[index * 4 + 1]; // green
  output[j * 4 + 2] = map[index * 4 + 2]; // red
  output[j * 4 + 3] = map[index * 4 + 3]; // alpha
};

// not sure these need to be separate functions...
TGA.readMappedPixel15 = function(input, map, mapOffset, offset, i, output, j)
{
  var index = input.getUint16(offset + (i * 2), true) + mapOffset;
  output[j * 4 + 0] = map[index * 4 + 0]; // blue
  output[j * 4 + 1] = map[index * 4 + 1]; // green
  output[j * 4 + 2] = map[index * 4 + 2]; // red
  output[j * 4 + 3] = map[index * 4 + 3]; // alpha
};

TGA.readMappedPixel16 = function(input, map, mapOffset, offset, i, output, j)
{
  var index = input.getUint16(offset + (i * 2), true) + mapOffset;
  output[j * 4 + 0] = map[index * 4 + 0]; // blue
  output[j * 4 + 1] = map[index * 4 + 1]; // green
  output[j * 4 + 2] = map[index * 4 + 2]; // red
  output[j * 4 + 3] = map[index * 4 + 3]; // alpha
};

// is this even valid?
TGA.readMappedPixel24 = function(input, map, mapOffset, offset, i, output, j)
{
  var index = input.getUint16(offset + (i * 2), true) + mapOffset; // uhhhhh
  output[j * 4 + 0] = map[index * 4 + 0]; // blue
  output[j * 4 + 1] = map[index * 4 + 1]; // green
  output[j * 4 + 2] = map[index * 4 + 2]; // red
  output[j * 4 + 3] = map[index * 4 + 3]; // alpha
};

// is this even valid, either?
TGA.readMappedPixel32 = function(input, map, mapOffset, offset, i, output, j)
{
  var index = input.getUint16(offset + (i * 2), true) + mapOffset; // uhhhhh
  output[j * 4 + 0] = map[index * 4 + 0]; // blue
  output[j * 4 + 1] = map[index * 4 + 1]; // green
  output[j * 4 + 2] = map[index * 4 + 2]; // red
  output[j * 4 + 3] = map[index * 4 + 3]; // alpha
};

TGA.readRLEImage = function(tga)
{
  console.log(tga.dataview, tga.header);
  throw 'NYI';
};

TGA.readColormappedImage = function(tga)
{
  var dataview = tga.dataview,
    header = tga.header,
    colorMap = tga.colorMap,
    width = header.imageSpec.width,
    height = header.imageSpec.height,
    pixels = new Uint8ClampedArray(width * height * 4),
    pixelDepth = header.imageSpec.pixelDepth,
    offset = HEADER_SIZE + header.idLength +
      (header.colorMapSpec.length * header.colorMapSpec.entrySizeBytes),
    mapOffset = header.colorMapSpec.firstEntry,
    read = null,
    vScanDir = (header.imageSpec.origin & IMAGE_ORIGIN_VERTICAL_MASK) === IMAGE_ORIGIN_TOP ? 1 : -1,
    hScanDir = (header.imageSpec.origin & IMAGE_ORIGIN_HORIZONTAL_MASK) === IMAGE_ORIGIN_RIGHT ? -1 : 1;

  if(!colorMap)
  {
    throw 'Image is described as color-mapped, but has no map';
  }

  switch(pixelDepth) {
    case 8:
      read = TGA.readMappedPixel8;
      break;
    case 16:
      read = TGA.readMappedPixel15;
      break;
    case 15:
      read = TGA.readMappedPixel16;
      break;
    case 24:
      read = TGA.readMappedPixel24;
      break;
    case 32:
      read = TGA.readMappedPixel32;
      break;
    default:
      throw 'Unsupported pixel depth';
  }

  var vStart, vEnd, hStart, hEnd;
  if(vScanDir > 0)
  {
    vStart = 0;
    vEnd = height;
  }
  else
  {
    vStart = height;
    vEnd = 0;
  }

  if(hScanDir > 0)
  {
    hStart = 0;
    hEnd = width;
  }
  else
  {
    hStart = width;
    hEnd = 0;
  }

  // output is always top->bottom, left->right, so:
  var row = 0, col;
  for(var i = vStart; i != vEnd; i += vScanDir)
  {
    col = 0;
    for(var j = hStart; j != hEnd; j += hScanDir)
    {
      read(dataview, colorMap, mapOffset, offset, (i - 1) * width + (j - 1), pixels, row * width + col++);
    }
    row++;
  }

  return pixels;
};

TGA.readTruecolorImage = function(tga)
{
  var header = tga.header,
    dataview = tga.dataview,
    width = header.imageSpec.width,
    height = header.imageSpec.height,
    pixels = new Uint8ClampedArray(width * height * 4),
    pixelDepth = header.imageSpec.pixelDepth,
    offset = HEADER_SIZE + header.idLength +
      (header.colorMapSpec.length * header.colorMapSpec.entrySizeBytes),
    read = null,
    vScanDir = (header.imageSpec.origin & IMAGE_ORIGIN_VERTICAL_MASK) === IMAGE_ORIGIN_TOP ? 1 : -1,
    hScanDir = (header.imageSpec.origin & IMAGE_ORIGIN_HORIZONTAL_MASK) === IMAGE_ORIGIN_RIGHT ? -1 : 1;

  switch(pixelDepth) {
    case 8:
      read = TGA.readPixel8;
      break;
    case 16:
      read = TGA.readPixel15;
      break;
    case 15:
      read = TGA.readPixel16;
      break;
    case 24:
      read = TGA.readPixel24;
      break;
    case 32:
      read = TGA.readPixel32;
      break;
    default:
      throw 'Unsupported pixel depth';
  }
  var vStart, vEnd, hStart, hEnd;
  if(vScanDir > 0)
  {
    vStart = 0;
    vEnd = height;
  }
  else
  {
    vStart = height;
    vEnd = 0;
  }

  if(hScanDir > 0)
  {
    hStart = 0;
    hEnd = width;
  }
  else
  {
    hStart = width;
    hEnd = 0;
  }

  // output is always top->bottom, left->right, so:
  var row = 0, col;
  for(var i = vStart; i != vEnd; i += vScanDir)
  {
    col = 0;
    for(var j = hStart; j != hEnd; j += hScanDir)
    {
      read(dataview, offset, (i - 1) * width + (j - 1), pixels, row * width + col++);
    }
    row++;
  }

  return pixels;
};

TGA.readImage = function(tga)
{
  if(tga.header.compressed)
  {
    return TGA.readRLEImage(tga);
  }
  else
  {
    if(tga.header.mapType === 0) // not color mapped:
    {
      return TGA.readTruecolorImage(tga);
    }
    else if(tga.header.mapType === 1) // color mapped
    {
      return TGA.readColormappedImage(tga);
    }
    else
    {
      throw 'Unsupported map type';
    }
  }
};

// Base function.
var libtga = {
  readFile: function(arraybuf) {
    return new TGA(arraybuf);
  },
  loadFile: function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      callback(null, new TGA(this.response));
    };
    xhr.onerror = function(e) {
      callback(e, null);
    };

    xhr.send();
  },
  TGA: TGA
};


// Version.
libtga.VERSION = '0.2.2';


// Export to the root, which is probably `window`.
root.libtga = libtga;


}(this));

//# sourceMappingURL=libtga.js.map
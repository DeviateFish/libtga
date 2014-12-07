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
  IMAGE_DESCRIPTOR_ATTRIBUTE_MASK = 0x7,
  IMAGE_DESCRIPTOR_ORIGIN_UPPER = 0x20,
  IMAGE_DESCRIPTOR_INTERLEAVE_MASK = 0xc0;

var TGA = function(arraybuf)
{
  this.dataview = new DataView(arraybuf);
  this.header = TGA.readHeader(this.dataview);
  this.width = this.header.imageSpec.width;
  this.height = this.header.imageSpec.height;
  this.compressed = !!(this.header.imageType & IMAGE_RUNLENGTH_ENCODED);
  this.imageId = TGA.readImageId(this.dataview, this.header);
  this.colorMap = TGA.readColorMap(this.dataview, this.header);
  this.imageData = TGA.readImage(this.dataview, this.header);
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
  var colorMapSpec = {
    firstEntry: dataview.getUint16(offset, true),
    colorMapLength: dataview.getUint16(offset+2, true),
    colorMapEntrySize: dataview.getUint8(offset+4, true)
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
    originUpper: (descriptor & IMAGE_DESCRIPTOR_ORIGIN_UPPER) == IMAGE_DESCRIPTOR_ORIGIN_UPPER,
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
  // stub:
  return new Uint8Array(
    dataview.buffer,
    HEADER_SIZE + header.idLength,
    header.colorMapSpec.colorMapLength * header.colorMapSpec.colorMapEntrySize);
};

TGA.readPixel15 = function(dataview, offset, i, pixels)
{
  var chunk = dataview.getUint16(offset + (i * 2), true);
  pixels[i * 4 + 2] = chunk & 0x1f; // blue
  pixels[i * 4 + 1] = (chunk >> 5) & 0x1f; // green
  pixels[i * 4 + 0] = (chunk >> 10) & 0x1f; // red
  pixels[i * 4 + 3] = 255; // alpha
};

TGA.readPixel16 = function(dataview, offset, i, pixels)
{
  var chunk = dataview.getUint16(offset + (i * 2), true);
  pixels[i * 4 + 2] = chunk & 0x1f; // blue
  pixels[i * 4 + 1] = (chunk >> 5) & 0x1f; // green
  pixels[i * 4 + 0] = (chunk >> 10) & 0x1f; // red
  pixels[i * 4 + 3] = (chunk & 0x80) == 0x80 ? 255 : 0; // alpha
};

TGA.readPixel24 = function(dataview, offset, i, pixels)
{
  pixels[i * 4 + 2] = dataview.getUint8(offset + (i * 3) + 0); //blue
  pixels[i * 4 + 1] = dataview.getUint8(offset + (i * 3) + 1); //green
  pixels[i * 4 + 0] = dataview.getUint8(offset + (i * 3) + 2); //red
  pixels[i * 4 + 3] = 255;
};

TGA.readPixel32 = function(dataview, offset, i, pixels)
{
  pixels[i * 4 + 2] = dataview.getUint8(offset + (i * 4) + 0); //blue
  pixels[i * 4 + 1] = dataview.getUint8(offset + (i * 4) + 1); //green
  pixels[i * 4 + 0] = dataview.getUint8(offset + (i * 4) + 2); //red
  pixels[i * 4 + 3] = dataview.getUint8(offset + (i * 4) + 3); // alpha
};

TGA.readImage = function(dataview, header)
{
  // I'm thinking I should store pixel data as Uint8Array,
  // 4 elements per pixel... i.e. full-blown 32-bit color, regardless
  // for tgas without attributes (alpha?), default alpha to 255?
  var width = header.imageSpec.width,
    height = header.imageSpec.height,
    pixels = new Uint8ClampedArray(width * height * 4),
    pixelDepth = header.imageSpec.pixelDepth,
    offset = HEADER_SIZE + header.idLength +
      (header.colorMapSpec.colorMapLength * header.colorMapSpec.colorMapEntrySize),
    read = null;

  switch(pixelDepth) {
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

  for(var i = 0; i < width * height; i++)
  {
    read(dataview, offset, i, pixels);
  }

  return pixels;
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
libtga.VERSION = '0.1.0';


// Export to the root, which is probably `window`.
root.libtga = libtga;
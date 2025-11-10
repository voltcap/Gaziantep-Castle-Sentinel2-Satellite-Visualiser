
var longitude = 37.383202;
var latitude = 37.066427;
var aoi = ee.Geometry.Point([longitude, latitude]);

var START_DATE = '2023-01-01';
var END_DATE = '2023-02-05';   
var MAX_CLOUD_COVER = 20; 

var S2_COLLECTION_ID = 'COPERNICUS/S2_SR_HARMONIZED';

var VIS_PARAMS = {
  min: 0,
  max: 2500,
  bands: ['B4', 'B3', 'B2'],
  gamma: 1.4
};

var imageCollection = ee.ImageCollection(S2_COLLECTION_ID)
    .filterDate(START_DATE, END_DATE)
    .filterBounds(aoi)
    .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', MAX_CLOUD_COVER)
    .sort('system:time_start', true)
    .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12']);

Map.centerObject(aoi, 16);

Map.setOptions('SATELLITE');

print('Sentinel-2 Image Search Results');
print('Total images found:', imageCollection.size());
print('Date range:', START_DATE, 'to', END_DATE);
print('Max cloud cover:', MAX_CLOUD_COVER + '%');

var count = imageCollection.size().getInfo();
if (count === 0) {
  print('NO IMAGES');
  print('Try: 1) Increase MAX_CLOUD_COVER');
  print('     2) Widen date range');
  print('     3) Check coordinates are correct');
} else {
  print('✓ Found', count, 'suitable images');
}

var imageList = imageCollection.toList(imageCollection.size());

var dateStrings = imageList.map(function(image) {
  var date = ee.Date(ee.Image(image).get('system:time_start'));
  var cloud = ee.Number(ee.Image(image).get('CLOUDY_PIXEL_PERCENTAGE')).format('%.2f');
  return date.format('YYYY-MM-dd')
             .cat(' (Cloud: ')
             .cat(cloud)
             .cat('%)');
}).getInfo();

print('Available dates:', dateStrings);

var pansharpenImage = function(image, geometry) {

  var rgb = image.select(['B4', 'B3', 'B2']);
  
  var clipped = rgb.clip(geometry);
  
  var percentiles = clipped.reduceRegion({
    reducer: ee.Reducer.percentile([2, 98]),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e9
  });
  
  var minR = ee.Number(percentiles.get('B4_p2'));
  var maxR = ee.Number(percentiles.get('B4_p98'));
  var minG = ee.Number(percentiles.get('B3_p2'));
  var maxG = ee.Number(percentiles.get('B3_p98'));
  var minB = ee.Number(percentiles.get('B2_p2'));
  var maxB = ee.Number(percentiles.get('B2_p98'));
  
  var stretched = ee.Image([
    clipped.select('B4').subtract(minR).divide(maxR.subtract(minR)).multiply(255),
    clipped.select('B3').subtract(minG).divide(maxG.subtract(minG)).multiply(255),
    clipped.select('B2').subtract(minB).divide(maxB.subtract(minB)).multiply(255)
  ]);
  
  return stretched;
};

var CLIP_BUFFER_M = 500;
var clipGeometry = aoi.buffer(CLIP_BUFFER_M);

Map.addLayer(clipGeometry, {color: 'FFFF00', fillColor: '00000000'}, 'Area of Interest (500m)', true);
Map.addLayer(aoi, {color: 'FF0000'}, 'Castle Location', true);

var visualiseImage = function(selectedDateString) {
  if (!selectedDateString) return;
  
  var selectedDate = selectedDateString.slice(0, 10);
  
  print('Loading image for:', selectedDate);
  
  var selectedImage = imageCollection
    .filterDate(selectedDate, ee.Date(selectedDate).advance(1, 'day'))
    .first();
  
  if (!selectedImage) {
    print('no image', selectedDate);
    return;
  }

  var standardImage = selectedImage
    .select(['B4', 'B3', 'B2'])
    .clip(clipGeometry);
  
  var pansharpenedImage = pansharpenImage(selectedImage, clipGeometry);
  
  var layersToRemove = [];
  Map.layers().forEach(function(layer) {
    var layerName = layer.getName();
    if (layerName && typeof layerName === 'string') {
      if (layerName.indexOf('Standard:') !== -1 || 
          layerName.indexOf('Enhanced:') !== -1 ||
          layerName.indexOf('False Color:') !== -1) {
        layersToRemove.push(layer);
      }
    }
  });
  
  layersToRemove.forEach(function(layer) {
    Map.layers().remove(layer);
  });

  Map.addLayer(
    standardImage, 
    VIS_PARAMS, 
    'Standard: ' + selectedDate,
    false  
  );
  
  Map.addLayer(
    pansharpenedImage,
    {min: 0, max: 255},
    'Enhanced: ' + selectedDate,
    true  
  );

  var falseColor = selectedImage
    .select(['B8', 'B4', 'B3'])
    .clip(clipGeometry);
  
  Map.addLayer(
    falseColor,
    {min: 0, max: 2500, gamma: 1.3},
    'False Color (NIR-R-G): ' + selectedDate,
    false  
  );
  
  print('Loaded image:', selectedDate);
  print('  - Enhanced view: Best for visual inspection');
  print('  - Standard view: Original Sentinel-2 colors');
  print('  - False Colour: NIR composite for damage detection');
};

var title = ui.Label({
  value: ' Gaziantep Castle PHASE project',
  style: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 0 10px 0'
  }
});

var instructions = ui.Label({
  value: 'choose a date',
  style: {fontSize: '12px', color: '666', margin: '0 0 10px 0'}
});

var dateLabel = ui.Label({
  value: 'Select Image Date:',
  style: {fontWeight: 'bold'}
});

var selector = ui.Select({
  items: dateStrings,
  placeholder: dateStrings.length > 0 ? 'Choose a date...' : 'No images found',
  onChange: visualiseImage,
  style: {stretch: 'horizontal'}
});

var infoLabel = ui.Label({
  value: 'Resolution: 10m per pixel\n' +
         'Earthquake: Feb 6, 2023\n' +
         'Layers: Toggle in Layers panel',
  style: {
    fontSize: '11px',
    color: '888',
    margin: '10px 0 0 0',
    whiteSpace: 'pre'
  }
});

var legendLabel = ui.Label({
  value: 'Layers\n' +
         '• Enhanced: Best visual clarity\n' +
         '• Standard: Original colors\n' +
         '• False Colour: Vegetation analysis',
  style: {
    fontSize: '11px',
    color: '444',
    margin: '10px 0 0 0',
    whiteSpace: 'pre',
    backgroundColor: 'EEEEEE',
    padding: '8px',
    border: '1px solid #CCC'
  }
});

var controlPanel = ui.Panel({
  widgets: [title, instructions, dateLabel, selector, infoLabel, legendLabel],
  style: {
    position: 'bottom-left',
    padding: '12px',
    width: '320px'
  }
});

Map.add(controlPanel);

if (dateStrings.length > 0) {
  selector.setValue(dateStrings[0]);
  print('script loaded');
  print('Select a date from the dropdown to view imagery.');
} else {
  print('no images found in date range.');
  print('Adjust parameters and re-run script.');
}

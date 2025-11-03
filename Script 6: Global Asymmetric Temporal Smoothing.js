// ==================================================================================
// Script 6: Global Asymmetric Temporal Smoothing
// (Implements Section 3.6d of the paper)
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. SETUP: LOAD DATA AND DEFINE PARAMETERS
// ----------------------------------------------------------------------------------

var aoi = ee.FeatureCollection('projects/user/assets/aoi');
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: 'FFFFFF', strokeWidth: 2, fillColor: '00000000'}, 'Area of Interest', true);

var lulc_asset_ids = [
  'projects/user/assets/LULC_1985_Final_Consistent',
  'projects/user/assets/LULC_1990_Final_Consistent',
  'projects/user/assets/LULC_2000_Final_Consistent',
  'projects/user/assets/LULC_2010_Final_Consistent',
  'projects/user/assets/LULC_2020_Final_Consistent',
  'projects/user/assets/LULC_2024_Final_FullPostProcess' // The Refined Reference Map
];
var years = [1985, 1990, 2000, 2010, 2020, 2024];

var palette = [ // 13-color palette for classes 0-12
  '0000FF', '00FFFF', '663300', 'FFFF00', 'FFC0CB', '800080',
  'FF0000', 'FFA500', '006400', '9ACD32', 'D2B48C', '90EE90', '556B2F'
];

// ----------------------------------------------------------------------------------
// 2. LOAD AND PREPARE THE TIME SERIES IMAGE COLLECTION
// ----------------------------------------------------------------------------------
print('--- Loading and preparing LULC time series ---');
var lulc_collection = ee.ImageCollection(lulc_asset_ids.map(function(id, index) {
  return ee.Image(id).select(0).rename('classification').set('year', years[index]);
}));

var lulc_list = lulc_collection.toList(lulc_collection.size());
Map.addLayer(ee.Image(lulc_list.get(0)).clip(aoi.geometry()), {min:0, max:12, palette:palette}, 'Original 1985 Map (Logically Corrected)', false);

// ----------------------------------------------------------------------------------
// 3. APPLY (d) GLOBAL ASYMMETRIC TEMPORAL SMOOTHING
// ----------------------------------------------------------------------------------
print('\n--- Applying (d) Global Asymmetric Temporal Smoothing ---');

var smoothed_list = []; // Use a client-side list for building the final collection
var map1985 = ee.Image(lulc_list.get(0));
var map1990 = ee.Image(lulc_list.get(1));
var map2000 = ee.Image(lulc_list.get(2));
var forwardStableMask = map1990.eq(map2000).and(map1985.neq(map1990));
var smoothed1985 = map1985.where(forwardStableMask, map1990).set('year', 1985);
smoothed_list.push(smoothed1985);
print('Year 1985: Forward-looking smoothing applied.');
Map.addLayer(smoothed1985.clip(aoi.geometry()), {min:0, max:12, palette:palette}, 'Smoothed 1985 Map', false);
for (var i = 1; i < years.length - 1; i++) {
  var previousImage = ee.Image(lulc_list.get(i - 1));
  var currentImage = ee.Image(lulc_list.get(i));
  var nextImage = ee.Image(lulc_list.get(i + 1));
  var temporalCollection = ee.ImageCollection([previousImage, currentImage, nextImage]);
  var smoothedImage = temporalCollection.median().rename('classification').set('year', years[i]);
  smoothed_list.push(smoothedImage);
  print('Year ' + years[i] + ': 3-point median filter applied.');
}
var map2024 = ee.Image(lulc_list.get(years.length - 1));
smoothed_list.push(map2024);
print('Year 2024: Kept as original baseline (no change).');
var smoothed_collection = ee.ImageCollection.fromImages(smoothed_list);

Map.addLayer(
  ee.Image(smoothed_list[5]).clip(aoi.geometry()), // Index 5 corresponds to 2024
  {min:0, max:12, palette:palette},
  'Final 2024 Map (Baseline - No Change)',
  true
);

// ----------------------------------------------------------------------------------
// 4. EXPORT THE "FINAL TEMPORALLY CONSISTENT LULC TIME SERIES"
// ----------------------------------------------------------------------------------
print('\n>>> Preparing export tasks for the "Final Temporally Consistent LULC Time Series"... <<<');

for (var j = 0; j < years.length; j++) {
  var year = years[j];
  var image = smoothed_collection.filter(ee.Filter.eq('year', year)).first();
  var exportDescription = 'LULC_' + year + '_Final_Temporally_Consistent';
  var exportFileName = 'LULC_' + year + '_Final_Temporally_Consistent';

  Export.image.toDrive({
    image: image.toByte(),
    description: exportDescription,
    folder: 'GEE_LULC_Exports_Final_TimeSeries',
    fileNamePrefix: exportFileName,
    region: aoi.geometry(),
    scale: 30,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });

  print('Export task created for year: ' + year);
}

// ==================================================================================
// END OF SCRIPT 6
// ==================================================================================

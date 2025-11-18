// ==================================================================================
// Script 6: Global Asymmetric Temporal Smoothing
// (Implements the conceptual logic from Section F of the paper)
// ==================================================================================
//  Purpose : This script provides the template for applying the final asymmetric 
//            temporal smoothing to a full LULC time series. It demonstrates:
//            1. The 3-point temporal median filter for intermediate epochs.
//            2. The asymmetric protection of the high-fidelity reference year.
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. SETUP: LOAD DATA AND DEFINE PARAMETERS
// ----------------------------------------------------------------------------------
var aoi = ee.FeatureCollection('projects/user/assets/aoi'); 
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: 'FFFFFF', strokeWidth: 2, fillColor: '00000000'}, 'Area of Interest', true);

// --- Asset IDs for "Logically Corrected Historical Maps" ---
// Note: User must provide their *own* list of LULC maps from Script 5.2.
var lulc_asset_ids = [
  'projects/user/assets/LULC_YYYY_Consistent', // e.g., 1990
  'projects/user/assets/LULC_YYYY_Consistent', // e.g., 2000
  'projects/user/assets/LULC_YYYY_Consistent', // e.g., 2010
  'projects/user/assets/LULC_YYYY_Consistent', // e.g., 2020
  'projects/user/assets/LULC_2024_Refined_Map' // The 2024 Reference Map
];
// Note: User must update this list to match their assets.
var years = [1990, 2000, 2010, 2020, 2024];

// --- Classification Parameters ---
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
Map.addLayer(ee.Image(lulc_list.get(0)).clip(aoi.geometry()), {min:0, max:12, palette:palette}, 'Original First-Year Map (Logically Corrected)', false);

// ----------------------------------------------------------------------------------
// 3. APPLY (d) GLOBAL ASYMMETRIC TEMPORAL SMOOTHING
// ----------------------------------------------------------------------------------
print('\n--- Applying (d) Global Asymmetric Temporal Smoothing ---');

var smoothed_list = []; // Use a client-side list for building the final collection

// --- (d.1) Handle the Start Year (e.g., 1990 in this example) ---
smoothed_list.push(ee.Image(lulc_list.get(0)));
print('Year ' + years[0] + ': Added (start-year logic omitted in this template).');

// --- (d.2) Handle Intermediate Epochs (e.g., 2000, 2010) with median filter ---
for (var i = 1; i < years.length - 1; i++) {
  var previousImage = ee.Image(lulc_list.get(i - 1));
  var currentImage = ee.Image(lulc_list.get(i));
  var nextImage = ee.Image(lulc_list.get(i + 1));
  var temporalCollection = ee.ImageCollection([previousImage, currentImage, nextImage]);
  var smoothedImage = temporalCollection.median().rename('classification').set('year', years[i]);
  smoothed_list.push(smoothedImage);
  print('Year ' + years[i] + ': 3-point median filter applied.');
}

// --- (d.3) Handle the Reference Year (2024): Left unchanged ---
var map2024 = ee.Image(lulc_list.get(years.length - 1));
smoothed_list.push(map2024);
print('Year ' + years[years.length - 1] + ': Kept as original baseline (no change).');
var smoothed_collection = ee.ImageCollection.fromImages(smoothed_list);

Map.addLayer(
  ee.Image(smoothed_list[smoothed_list.length - 1]).clip(aoi.geometry()), 
  {min:0, max:12, palette:palette},
  'Final Reference Map (Baseline - No Change)',
  true
);

print('\n--- Temporal smoothing logic complete. ---');
print('--- Results are displayed in the Map Viewer. Export functions are not included in this template. ---');

// ==================================================================================
// END OF SCRIPT 6
// ==================================================================================

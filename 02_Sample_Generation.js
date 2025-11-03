// ==================================================================================
// Script 2: Reference Sample Generation (Manual Interpretation Tool)
// Description: This script serves as the UI for generating the high-fidelity
// reference year (2024) training polygons, as described in Section 3.3.
// It loads all 34 features (the "Key Phenological-Stage Feature Set") to guide
// manual visual interpretation.
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. Configuration & Reference Data
// ----------------------------------------------------------------------------------

// --- Asset Paths ---
var EXISTING_SAMPLES_ASSET = 'projects/ee-xiuneng/assets/2024_landcover_polygons_0703';
var ASSET_PATH_POINTS = 'projects/ee-xiuneng/assets/shididiaochadian0630'; // Field data points
var aoi = ee.FeatureCollection('projects/ee-xiuneng/assets/processingAndEvalAoi');

// --- Feature Stack Asset (from Script 01) ---
// This is the "Key Phenological-Stage Feature Set" (N=34)
var featureStackAssetId = 'projects/ee-xiuneng/assets/FeatureStack_Landsat_2024_v4';

// --- (Optional) Ancillary Phenology (SOS/EOS) Assets ---
var sosAssetId = 'projects/ee-xiuneng/assets/2024_SOS';
var eosAssetId = 'projects/ee-xiuneng/assets/2024_EOS';

// --- (Optional) Load a final LULC map for visual reference ---
var referenceLULC = ee.Image('projects/ee-xiuneng/assets/LULC_2024_Jiangsu_Final_PostProcessed_Corrected_extract');
var lulcPalette = [
  '0070FF', // 0: River
  'BEE8FF', // 1: Lake
  'A8A800', // 2: Mudflat
  'FFFF00', // 3: Paddy Field
  '00C5FF', // 4: Aquaculture Pond
  'FF5500', // 5: Reservoir
  'FFBEBE', // 6: Built-up Land
  '55FF00', // 7: Dry Cropland
  '267300', // 8: Forest
  'E9FFBE', // 9: Grassland
  '730000', // 10: Bare Land
  '89CD66', // 11: Herbaceous Wetland
  'CDAA66'  // 12: Woody Wetland
];
Map.addLayer(referenceLULC.select('b1'), {min: 0, max: 12, palette: lulcPalette}, 'LULC 2024 (Reference Map)', false);


// ----------------------------------------------------------------------------------
// 2. Load Data for Visualization
// ----------------------------------------------------------------------------------

// --- Load AOI ---
Map.addLayer(aoi, {color: 'FFFFFF', strokeWidth: 2, fillColor: '00000000'}, 'Processing & Evaluation AOI', true);
Map.centerObject(aoi, 8);

// --- Load existing training polygons (the set to be augmented) ---
var existingFeatures = ee.FeatureCollection(EXISTING_SAMPLES_ASSET);
Map.addLayer(existingFeatures, {color: 'FFFFFF', strokeWidth: 1.5, fillColor: 'FFFFFF33'}, 'Existing Polygons (to be augmented)', true);

// --- Load reference field points (optional ancillary data) ---
var allPoints = ee.FeatureCollection(ASSET_PATH_POINTS);
var styleLegend = {
  '0': {name: 'River (Field Points)', color: '00FFFF'},
  '1': {name: 'Lake (Field Points)', color: 'FF0000'},
  '4': {name: 'Aquaculture (Field Points)', color: '00FF00'},
  '5': {name: 'Reservoir (Field Points)', color: 'FFFF00'},
  '11': {name: 'Marsh (Field Points)', color: 'FF00FF'}
};
for (var key in styleLegend) {
  var landcoverValue = parseInt(key, 10);
  var style = styleLegend[key];
  var filteredPoints = allPoints.filter(ee.Filter.eq('landcover', landcoverValue));
  Map.addLayer(filteredPoints, {color: style.color, pointSize: 4}, style.name, false); 
}

// --- Load Feature Stack Asset ---
var featureStack2024 = ee.Image(featureStackAssetId);
print('Loading Feature Stack Asset: ' + featureStackAssetId);

// --- Load optional SOS/EOS assets ---
var sosImage, eosImage, losImage;
try {
  sosImage = ee.Image(sosAssetId).rename('SOS_ref');
  eosImage = ee.Image(eosAssetId).rename('EOS_ref');
  losImage = eosImage.subtract(sosImage).rename('LOS_ref');
} catch (phenoError) {
  print('Could not load separate SOS/EOS assets for reference.', phenoError);
}


// ----------------------------------------------------------------------------------
// 3. Add Feature Visualization Layers
// (These layers guide the manual interpretation)
// ----------------------------------------------------------------------------------

if (featureStack2024) {
  // --- A. Base Landsat Composites ---
  Map.addLayer(featureStack2024, {bands: ['Red', 'Green', 'Blue'], min: 0, max: 0.3}, 'A. True Color (Annual)', true);
  Map.addLayer(featureStack2024, {bands: ['NIR', 'Red', 'Green'], min: 0, max: 0.4}, 'A. False Color (NIR-R-G)', false);
  Map.addLayer(featureStack2024, {bands: ['SWIR1', 'NIR', 'Red'], min: 0, max: 0.5}, 'A. False Color (SWIR-NIR-R)', false);

  // --- B. Common Spectral Indices (Annual Composite) ---
  var ndviPalette = ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901', '66A000', '529400', '3E8601', '207401', '056201', '004C00'];
  var waterPalette = ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6']; // Dry (red) to Wet (blue)
  var builtupPalette = ['#006837', '#a6d96a', '#ffffbf', '#fee08b', '#fdae61', '#d73027']; // Green to Red
  Map.addLayer(featureStack2024.select('NDVI'), {min: 0, max: 0.9, palette: ndviPalette}, 'B. NDVI (Annual)', false);
  Map.addLayer(featureStack2024.select('MNDWI_G_SWIR1'), {min: -0.5, max: 0.8, palette: ['brown', 'white', 'blue']}, 'B. MNDWI (G-SWIR1)', false);
  Map.addLayer(featureStack2024.select('LSWI'), {min: -0.5, max: 0.5, palette: waterPalette}, 'B. LSWI (Moisture)', false);
  Map.addLayer(featureStack2024.select('NDBI'), {min: -0.4, max: 0.6, palette: builtupPalette}, 'B. NDBI (Built-up)', false);
  
  // --- C. Topographic Features ---
  Map.addLayer(featureStack2024.select('Elevation'), {min: 0, max: 100, palette: ['440154', '2A788E', '7AD151', 'FDE725']}, 'C. Elevation', false);
  Map.addLayer(featureStack2024.select('Slope'), {min: 0, max: 10, palette: ['0D0887', 'B12A90', 'FCA636', 'F0F921']}, 'C. Slope', false);
  Map.addLayer(featureStack2024.select('TWI'), {min: 5, max: 20, palette: ['3B4CC0', 'FFFFFF', 'F03B20']}, 'C. TWI', false);

  // --- D. Annual Temporal Variability Metrics ---
  Map.addLayer(featureStack2024.select('NDVI_stdDev'), {min: 0, max: 0.3, palette: ['white', 'yellow', 'orange', 'red']}, 'D. NDVI Std Dev', false);
  Map.addLayer(featureStack2024.select('LSWI_stdDev'), {min: 0, max: 0.4, palette: ['white', 'blue']}, 'D. LSWI Std Dev', false);

  // --- E. Key Phenological-Stage Features (Critical for discriminating classes) ---
  var riceWaterPalette = ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695'];
  var riceVegPalette = ['#8c510a','#d8b365','#f6e8c3','#c7eae5','#5ab4ac','#01665e'];
  Map.addLayer(featureStack2024.select('LSWI_flood'), {min: -0.2, max: 0.8, palette: riceWaterPalette}, 'E. LSWI (Flooding Stage)', false);
  Map.addLayer(featureStack2024.select('NDVI_flood'), {min: -0.1, max: 0.5, palette: riceVegPalette}, 'E. NDVI (Flooding Stage)', false);
  Map.addLayer(featureStack2024.select('LSWI_m_NDVI_flood'), {min: -0.5, max: 1, palette: ['red','yellow','blue']}, 'E. LSWI-NDVI (Flooding Stage)', false);
  Map.addLayer(featureStack2024.select('NDVI_peak'), {min: 0.2, max: 0.9, palette: riceVegPalette}, 'E. NDVI (Peak Growing Stage)', false);
}
if (sosImage && eosImage && losImage) {
  // --- F. Ancillary Phenology (SOS/EOS) ---
  var phenoPalette = ['0000FF', '00FFFF', '00FF00', 'FFFF00', 'FF0000'];
  Map.addLayer(sosImage.clip(aoi.geometry()), {min: 1, max: 365, palette: phenoPalette}, 'F. SOS (Reference)', false);
  Map.addLayer(eosImage.clip(aoi.geometry()), {min: 1, max: 365, palette: phenoPalette}, 'F. EOS (Reference)', false);
  Map.addLayer(losImage.clip(aoi.geometry()), {min: 0, max: 250, palette: ['FF0000', 'FFFF00', '00FF00']}, 'F. LOS (Reference)', false);
}

// ----------------------------------------------------------------------------------
// 4. Sample Merging and Export
// ----------------------------------------------------------------------------------

// IMPORTANT: The variables below (NW_River, NW_Lake, etc.) 
// MUST be defined as Imports from the UI drawing tool.
// These are the new polygons drawn via manual interpretation.
var listOfNewFeatureCollections = [
  NW_River, NW_Lake, NW_Inland_Flat, AW_Paddy, AW_Aquaculture,
  AW_Reservoir, Urban, DryCropland, UplandForest, Grassland, BareLand, Herbaceous_Marsh, Woody_Swamp
];

// --- Step 1: Merge all new polygons drawn in the UI ---
var newlyAddedFeatures = ee.FeatureCollection(listOfNewFeatureCollections).flatten();

// --- Step 2: Merge new polygons with the existing polygon set ---
var combinedFeatures = existingFeatures.merge(newlyAddedFeatures);

// --- Step 3: Validation and Report ---
print('-----------------------------------------------------------------');
print('Sample Merge Report:');
print('Number of existing polygons (from Asset):', existingFeatures.size());
print('Number of newly drawn polygons (from UI):', newlyAddedFeatures.size());
print('Total combined polygons for export:', combinedFeatures.size());
print('-----------------------------------------------------------------');

// --- Step 4: Export the Combined Polygon Set to Asset ---
var outputAssetId = 'projects/ee-xiuneng/assets/2024_landcover_polygons_0704'; // Final output asset path

Export.table.toAsset({
  collection: combinedFeatures,
  description: 'Export_Combined_Landcover_Polygons_v1', // Task name in the Tasks tab
  assetId: outputAssetId
});

print('Script complete. Run the export task in the "Tasks" tab.');
print('New asset will be saved to:', outputAssetId);

// ==================================================================================
// END OF SCRIPT
// ==================================================================================

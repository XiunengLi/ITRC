// ==================================================================================
// Script 2: Reference Year (2024) Sample Generation
// Description: This script provides the visualization environment for creating the
// high-fidelity 2024 reference sample polygons (as described in Section C).
// ==================================================================================

// ==================================================================================
// PART 1: LOAD VISUALIZATION LAYERS
// ==================================================================================

var aoi = ee.FeatureCollection('projects/user/assets/aoi');
Map.addLayer(aoi, {color: 'FFFFFF', strokeWidth: 2, fillColor: '00000000'}, 'Processing & Evaluation AOI', true);
Map.centerObject(aoi, 8);

var featureStackAssetId = 'projects/user/assets/FeatureStack_Landsat_2024_Enhanced_Masked';
print('Loading Key Phenological-Stage Feature Set for Visualization: ' + featureStackAssetId);
var featureStack2024;
try {
  featureStack2024 = ee.Image(featureStackAssetId);
} catch (error) {
  print('Error loading Feature Stack Asset!', error);
  throw new Error('Failed to load Feature Stack Asset.');
}

if (featureStack2024) {
  // --- A. Base Landsat Band Composites ---
  Map.addLayer(featureStack2024, {bands: ['Red', 'Green', 'Blue'], min: 0, max: 0.3}, 'A. True Color (Annual)', true);
  Map.addLayer(featureStack2024, {bands: ['NIR', 'Red', 'Green'], min: 0, max: 0.4}, 'A. False Color (NIR-R-G)', false);
  Map.addLayer(featureStack2024, {bands: ['SWIR1', 'NIR', 'Red'], min: 0, max: 0.5}, 'A. False Color (SWIR-NIR-R)', false);

  var ndviPalette = ['FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718', '74A901', '66A000', '529400', '3E8601', '207401', '056201', '004C00'];
  var waterPalette = ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6']; // Dry (red) to Wet (blue)
  var builtupPalette = ['#006837', '#a6d96a', '#ffffbf', '#fee08b', '#fdae61', '#d73027']; // Green to Red
  var stdDevPalette = ['white', 'yellow', 'orange', 'red']; // Low to High variability
  
  // --- B. Common Spectral Indices (Annual Composite) ---
  Map.addLayer(featureStack2024.select('NDVI'), {min: 0, max: 0.9, palette: ndviPalette}, 'B. NDVI (Annual)', false);
  Map.addLayer(featureStack2024.select('EVI'), {min: 0, max: 1, palette: ['FFFFFF', '00FF00']}, 'B. EVI (Annual)', false);
  Map.addLayer(featureStack2024.select('SAVI'), {min: 0, max: 1, palette: ['FFFFFF', '008000']}, 'B. SAVI (Annual)', false);
  Map.addLayer(featureStack2024.select('NDWI_G_NIR'), {min: -0.5, max: 0.8, palette: ['brown', 'white', 'cyan']}, 'B. NDWI (G-NIR)', false);
  Map.addLayer(featureStack2024.select('MNDWI_G_SWIR1'), {min: -0.5, max: 0.8, palette: ['brown', 'white', 'blue']}, 'B. MNDWI (G-SWIR1)', false);
  Map.addLayer(featureStack2024.select('LSWI'), {min: -0.5, max: 0.5, palette: waterPalette}, 'B. LSWI (Moisture)', false);
  Map.addLayer(featureStack2024.select('NDBI'), {min: -0.4, max: 0.6, palette: builtupPalette}, 'B. NDBI (Built-up)', false);
  Map.addLayer(featureStack2024.select('AWEIsh'), {min: -2, max: 2, palette: ['black','white', 'darkblue']}, 'B. AWEIsh', false);
  Map.addLayer(featureStack2024.select('AWEInsh'), {min: -2, max: 1, palette: ['black', 'white', 'lightblue']}, 'B. AWEInsh', false);

  // --- C. Topographic Features ---
  Map.addLayer(featureStack2024.select('Elevation'), {min: 0, max: 100, palette: ['440154', '2A788E', '7AD151', 'FDE725']}, 'C. Elevation', false);
  Map.addLayer(featureStack2024.select('Slope'), {min: 0, max: 10, palette: ['0D0887', 'B12A90', 'FCA636', 'F0F921']}, 'C. Slope', false);
  Map.addLayer(featureStack2024.select('TWI'), {min: 5, max: 20, palette: ['3B4CC0', 'FFFFFF', 'F03B20']}, 'C. TWI', false);

  // --- D. Annual Temporal Variability Metrics ---
  Map.addLayer(featureStack2024.select('NDVI_stdDev'), {min: 0, max: 0.3, palette: stdDevPalette}, 'D. NDVI Std Dev', false);
  Map.addLayer(featureStack2024.select('LSWI_stdDev'), {min: 0, max: 0.4, palette: ['white', 'blue']}, 'D. LSWI Std Dev', false);
  Map.addLayer(featureStack2024.select('MNDWI_G_SWIR1_stdDev'), {min: 0, max: 0.4, palette: ['white', 'cyan']}, 'D. MNDWI Std Dev', false);
  Map.addLayer(featureStack2024.select('NDWI_G_NIR_stdDev'), {min: 0, max: 0.4, palette: ['white', 'purple']}, 'D. NDWI Std Dev', false);

  // --- E. Key Phenological-Stage Features (Paddy) ---
  var riceWaterPalette = ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695'];
  var riceVegPalette = ['#8c510a','#d8b365','#f6e8c3','#c7eae5','#5ab4ac','#01665e'];
  Map.addLayer(featureStack2024.select('LSWI_flood'), {min: -0.2, max: 0.8, palette: riceWaterPalette}, 'E. LSWI (Flooding Stage)', false);
  Map.addLayer(featureStack2024.select('NDVI_flood'), {min: -0.1, max: 0.5, palette: riceVegPalette}, 'E. NDVI (Flooding Stage)', false);
  Map.addLayer(featureStack2024.select('MNDWI_flood'), {min: -0.2, max: 0.8, palette: riceWaterPalette}, 'E. MNDWI (Flooding Stage)', false);
  Map.addLayer(featureStack2024.select('LSWI_m_NDVI_flood'), {min: -0.5, max: 1, palette: ['red','yellow','blue']}, 'E. LSWI-NDVI (Flooding Stage)', false);
  Map.addLayer(featureStack2024.select('NDVI_peak'), {min: 0.2, max: 0.9, palette: riceVegPalette}, 'E. NDVI (Peak Growing Stage)', false);
  Map.addLayer(featureStack2024.select('EVI_peak'), {min: 0.1, max: 0.8, palette: riceVegPalette}, 'E. EVI (Peak Growing Stage)', false);
  Map.addLayer(featureStack2024.select('LSWI_peak'), {min: -0.5, max: 0.6, palette: riceWaterPalette}, 'E. LSWI (Peak Growing Stage)', false);

}

// ==================================================================================
// PART 2: NEW REFERENCE SAMPLE EXPORT
// ==================================================================================

var listOfNewFeatureCollections = [
  River, Lake, Mudflat, Paddy_Field, Aquaculture_Pond,
  Reservoir, Built_up_Land, Dry_Cropland, Forest, Grassland, Bare_Land, Herbaceous_Wetland, Woody_Wetland
];
var newReferencePolygons = ee.FeatureCollection(listOfNewFeatureCollections).flatten();
print('-----------------------------------------------------------------');
print('New Reference Sample Export Report:');
print('Total new polygons for export:', newReferencePolygons.size());
print('-----------------------------------------------------------------');

var outputAssetId = 'projects/user/assets/2024_landcover_polygons; // <-- Final output asset path
Export.table.toAsset({
  collection: newReferencePolygons, // Export ONLY the new polygons
  description: 'Export_New_2024_Reference_Polygons', // Task name in the Tasks tab
  assetId: outputAssetId
});

print('Script complete. Check the console for the report, then run the export task in the "Tasks" tab.');
print('New reference asset will be saved to:', outputAssetId);

// ==================================================================================
// END OF SCRIPT
// ==================================================================================

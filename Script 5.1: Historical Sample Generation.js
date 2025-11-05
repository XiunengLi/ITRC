// ==================================================================================
// Script 5.1: Historical Sample Generation (Year 2020)
// (Implements the Sample Migration & Augmentation strategy from Section C)
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. SETUP: LOAD ASSETS AND DEFINE PARAMETERS
// ----------------------------------------------------------------------------------

var aoi = ee.FeatureCollection('projects/user/assets/aoi');
Map.centerObject(aoi, 9);
var changeMaskId = 'projects/user/assets/ChangeMask_2024_to_2020'; //get from Change Vector Analysis (CVA)
var samples2024Id = 'projects/user/assets/2024_landcover_polygons';
var classProperty = 'landcover';
var enhancedFeatureStackId_2020 = 'projects/user/assets/FeatureStack_Landsat_2020_Enhanced_Masked';
var annualRobustFeatureStackId_2020 = 'projects/user/assets/FeatureStack_Landsat_2020_AnnualRobust_NoGaps';
print('Loading core assets...');
var changeMask = ee.Image(changeMaskId);
var samples2024 = ee.FeatureCollection(samples2024Id);

// ----------------------------------------------------------------------------------
// 2. VISUALIZATION SETUP (Ancillary Data for Augmentation)
// ----------------------------------------------------------------------------------
print('Setting up map visualization for manual augmentation...');
print('--- Loading 2020 Feature Stacks for Visualization ---');
var enhancedStack_2020 = ee.Image(enhancedFeatureStackId_2020);
var robustStack_2020 = ee.Image(annualRobustFeatureStackId_2020);
print('-> Adding visualization layers from Robust Annual Stack...');
Map.addLayer(robustStack_2020.clip(aoi.geometry()),
   {bands: ['Red', 'Green', 'Blue'], min: 0, max: 0.3},
   '2020 True Color (Annual Robust)', true); // Set as default view
Map.addLayer(robustStack_2020.select('AWEIsh'),
  {min: -0.2, max: 0.4, palette: ['black','white', 'darkblue']},
  'AWEIsh (Annual Robust)', false);
Map.addLayer(robustStack_2020.select('NDVI'),
  {min: 0, max: 0.9, palette: ['FFFFFF','green']},
  'NDVI (Annual Robust)', false);
Map.addLayer(robustStack_2020.select('MNDWI_G_SWIR1'),
  {min: -0.5, max: 0.8, palette: ['brown', 'white', 'blue']},
  'MNDWI (Annual Robust)', false);
Map.addLayer(robustStack_2020.select('LSWI'),
  {min: -0.5, max: 0.5, palette: ['red','yellow','cyan','blue']},
  'LSWI (Annual Robust)', false);
Map.addLayer(robustStack_2020.select('TWI'),
  {min: 5, max: 20, palette: ['#3B4CC0', 'FFFFFF', 'F03B20']},
  'TWI (Topography)', false);
Map.addLayer(robustStack_2020.select('MNDWI_G_SWIR1_stdDev'),
  {min: 0, max: 0.4, palette: ['white', 'cyan']},
  'MNDWI Std Dev (Annual Robust)', false);

print('-> Adding visualization layers from Enhanced Phenology Stack...');
var riceWaterPalette = ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695'];
var riceVegPalette = ['#8c510a','#d8b365','#f6e8c3','#c7eae5','#5ab4ac','#01665e'];
Map.addLayer(enhancedStack_2020.select('NDVI_flood'),
  {min: 0.2, max: 0.9, palette: riceVegPalette},
  'NDVI (Flooding Stage)', false);
Map.addLayer(enhancedStack_2020.select('LSWI_flood'),
  {min: -0.2, max: 0.8, palette: riceWaterPalette},
  'LSWI (Flooding Stage)', false);
Map.addLayer(enhancedStack_2020.select('NDVI_peak'),
  {min: 0.2, max: 0.9, palette: riceVegPalette},
  'NDVI (Peak Growing Stage)', false);
Map.addLayer(enhancedStack_2020.select('LSWI_peak'),
  {min: -0.2, max: 0.8, palette: riceWaterPalette},
  'LSWI (Peak Growing Stage)', false);
Map.addLayer(enhancedStack_2020.select('EVI_peak'),
  {min: 0.1, max: 0.8, palette: riceVegPalette},
  'EVI (Peak Growing Stage)', false);
Map.addLayer(enhancedStack_2020.select('LSWI_m_NDVI_flood'),
  {min: -0.5, max: 1, palette: ['red','yellow','blue']},
  'LSWI-NDVI (Flooding Stage)', false);
Map.addLayer(changeMask.selfMask(), {palette: 'orange', opacity: 0.5}, 'Change-Affected Areas (for Augmentation)');
Map.addLayer(samples2024, {color: 'FF0000', fillColor: '00000000'}, '2024 Reference Samples (Original)');


// ----------------------------------------------------------------------------------
// 3. Step (a): Sample Migration (from Stable Zones)
// ----------------------------------------------------------------------------------
print('\n--- Step (a): Migrating samples from stable zones ---');
var stableMask = changeMask.eq(0);
var samplesWithStableArea = stableMask.rename('stable').reduceRegions({
  collection: samples2024,
  reducer: ee.Reducer.mean(), // mean of a binary mask = percentage of area
  scale: 30
});

var stabilityThreshold = 0.95; // Inherit samples with >95% spatial overlap with stable zones
var stableSamplesFor2020 = samplesWithStableArea.filter(
  ee.Filter.gte('mean', stabilityThreshold)
);

print('Number of original 2024 reference samples:', samples2024.size());
print('Number of samples migrated for 2020 (in stable zones):', stableSamplesFor2020.size());
Map.addLayer(stableSamplesFor2020, {color: '00FF00'}, 'Migrated Stable Samples (2020)', false); // Display in green

// ----------------------------------------------------------------------------------
// 4. Step (b): Sample Augmentation (in Change-Affected Areas)
// ----------------------------------------------------------------------------------
print('\n--- Step (b): Manual Sample Augmentation Setup ---');
print('>>> ACTION REQUIRED: Please manually draw new sample polygons for 2020. <<<');
print('>>> Focus sampling ONLY within the "Change-Affected Areas" (orange). <<<');
print('>>> Use the "Geometry Imports" section to create a new layer for each class (e.g., "manual_River"). <<<');

// ----------------------------------------------------------------------------------
// 5. Step (c): Combine and Export Final 2020 Sample Set
//    (Run this section AFTER manual sampling is complete)
// ----------------------------------------------------------------------------------

// <<<--- UNCOMMENT this entire block (from /* to */) after manual sampling is complete ---<<<

/*
print('\n--- Step (c): Combining migrated and augmented samples for 2020 ---');
var manualClassificationScheme = [
  {labelName: 'manual_River',               classValue: 0,  importName: manual_River},
  {labelName: 'manual_Lake',                classValue: 1,  importName: manual_Lake},
  {labelName: 'manual_Mudflat',             classValue: 2,  importName: manual_Mudflat},
  {labelName: 'manual_Paddy_Field',         classValue: 3,  importName: manual_Paddy_Field},
  {labelName: 'manual_Aquaculture_Pond',    classValue: 4,  importName: manual_Aquaculture_Pond},
  {labelName: 'manual_Reservoir',           classValue: 5,  importName: manual_Reservoir},
  {labelName: 'manual_Built_up_Land',       classValue: 6,  importName: manual_Built_up_Land},
  {labelName: 'manual_Dry_Cropland',        classValue: 7,  importName: manual_Dry_Cropland},
  {labelName: 'manual_Forest',              classValue: 8,  importName: manual_Forest},
  {labelName: 'manual_Grassland',           classValue: 9,  importName: manual_Grassland},
  {labelName: 'manual_Bare_Land',           classValue: 10, importName: manual_Bare_Land},
  {labelName: 'manual_Herbaceous_Wetland',  classValue: 11, importName: manual_Herbaceous_Wetland},
  {labelName: 'manual_Woody_Wetland',       classValue: 12, importName: manual_Woody_Wetland}
];

var allManualSamples = ee.FeatureCollection([]);
manualClassificationScheme.forEach(function(classInfo) {
  // Try to load the imported FC. If it doesn't exist or is empty, skip it.
  try {
    var importedFC = ee.FeatureCollection(classInfo.importName);
    if (importedFC.size().getInfo() > 0) {
      var featuresWithLabel = importedFC.map(function(feature) {
        return ee.Feature(feature.geometry()).set(classProperty, classInfo.classValue);
      });
      allManualSamples = allManualSamples.merge(featuresWithLabel);
    }
  } catch(e) {
    // This catches errors if an import (e.g., manual_River) was not created.
  }
});
print('Total manually drawn (augmented) samples:', allManualSamples.size());

// Combine the migrated stable samples with the new manual (augmented) samples
var finalSamples2020 = stableSamplesFor2020.merge(allManualSamples);
print('FINAL TOTAL SAMPLES FOR 2020 (Migrated + Augmented):', finalSamples2020.size());

Map.addLayer(allManualSamples, {color: 'red'}, 'New Manual (Augmented) Samples', false);

// --- Export the final 2020 sample set ---
print('\n>>> Preparing to export the final 2020 training samples to an Asset... <<<');
var exportAssetId = 'projects/ee-xiuneng/assets/2020_landcover_polygons_final'; // <-- Final 2020 Sample Asset ID
Export.table.toAsset({
  collection: finalSamples2020,
  description: 'Final_TrainingSamples_LULC_2020',
  assetId: exportAssetId
});

*/
// <<<--- End of section to uncomment ---<<<

// ==================================================================================
// END OF SCRIPT 5.1
// ==================================================================================

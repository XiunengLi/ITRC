// ==================================================================================
// Script 5.2: Post-Classification Logical Consistency Correction (2024 vs 2020)
// (Implements Section F of the paper)
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. SETUP: LOAD DATA AND DEFINE PARAMETERS
// ----------------------------------------------------------------------------------
var aoi = ee.FeatureCollection('projects/user/assets/aoi');
Map.centerObject(aoi, 9);
Map.addLayer(aoi, {color: 'FFFFFF', strokeWidth: 2, fillColor: '00000000'}, 'A. Processing & Evaluation AOI', true);

var map2024_Id = ''; //refined 2024 map
var map2020_Id = ''; //refined 2024 map

var riverValue = 0;
var lakeValue = 1;
var mudflatValue = 2;              
var paddyValue = 3;                
var aquaculturePondValue = 4;      
var reservoirValue = 5;
var builtUpValue = 6;              
var dryCroplandValue = 7;
var forestValue = 8;               
var grasslandValue = 9;
var bareLandValue = 10;
var herbaceousWetlandValue = 11;   
var woodyWetlandValue = 12;        
var palette = [
  '0000FF', // 0: River
  '00FFFF', // 1: Lake
  '663300', // 2: Mudflat
  'FFFF00', // 3: Paddy Field
  'FFC0CB', // 4: Aquaculture Pond
  '800080', // 5: Reservoir
  'FF0000', // 6: Built-up Land
  'FFA500', // 7: Dry Cropland
  '006400', // 8: Forest
  '9ACD32', // 9: Grassland
  'D2B48C', // 10: Bare Land
  '90EE90', // 11: Herbaceous Wetland
  '556B2F'  // 12: Woody Wetland
];

// --- Tunable Parameter for Morphological Optimization ---
var changePatchMinSize = 30; // (pixels) Final change patches smaller than this will be removed as noise.

// ----------------------------------------------------------------------------------
// 2. LOAD DATA AND IDENTIFY INITIAL DISAGREEMENT
// ----------------------------------------------------------------------------------
print('--- Step 1: Loading maps and identifying initial disagreements ---');

var map2024 = ee.Image(map2024_Id).clip(aoi.geometry()); // Refined Reference Map
var map2020 = ee.Image(map2020_Id).clip(aoi.geometry()); // Refined Historical Map
Map.addLayer(map2024, {min: 0, max: 12, palette: palette}, 'Map 2024 (Refined Reference)', false);
Map.addLayer(map2020, {min: 0, max: 12, palette: palette}, 'Map 2020 (Refined Historical)', false);
var initialDisagreementMask = map2024.neq(map2020);
Map.addLayer(initialDisagreementMask.selfMask(), {palette: 'yellow'}, 'Initial Disagreement Mask', false);
print('Initial disagreement mask generated.');

// ----------------------------------------------------------------------------------
// 3. Post-Classification Logical Consistency Constraints 
// ----------------------------------------------------------------------------------
print('\n--- Step 2: Applying logical consistency rules ---');

var stableUrbanMask = map2024.eq(builtUpValue).and(map2020.eq(builtUpValue));
var stableUrbanCore = stableUrbanMask.focal_min(2); // Erode to get core urban nuclei.
var isCropland2024 = map2024.eq(paddyValue).or(map2024.eq(dryCroplandValue));
var isCropland2020 = map2020.eq(paddyValue).or(map2020.eq(dryCroplandValue));
var stableCroplandMask = isCropland2024.and(isCropland2020);
var waterClasses = [riverValue, lakeValue, mudflatValue, aquaculturePondValue, reservoirValue];
var isWater2024 = map2024.remap(waterClasses, ee.List.repeat(1, waterClasses.length), 0);
var isWater2020 = map2020.remap(waterClasses, ee.List.repeat(1, waterClasses.length), 0);
var stableWaterMask = isWater2024.and(isWater2020);
var nonReversibleClasses = [
  paddyValue, dryCroplandValue, forestValue, woodyWetlandValue,
  herbaceousWetlandValue, grasslandValue, mudflatValue, riverValue,
  lakeValue, reservoirValue, aquaculturePondValue
];
var urbanReversionMask = map2020.eq(builtUpValue) // 2020 is Built-up
  .and(map2024.remap(nonReversibleClasses, ee.List.repeat(1, nonReversibleClasses.length)).eq(1)); // 2024 is Natural/Ag

var urbanToForestMask = map2020.eq(builtUpValue).and(map2024.eq(forestValue));
var forestToSwampMask = map2020.eq(forestValue).and(map2024.eq(woodyWetlandValue));
var paddyToForestMask = map2020.eq(paddyValue).and(map2024.eq(forestValue));
// (This is a valid change, not an illogical one, but kept per original logic)
var isForest2024 = map2024.eq(forestValue).or(map2024.eq(woodyWetlandValue));
var croplandToForestMask = isCropland2020.and(isForest2024);

var noChangeMask = stableUrbanCore
  .or(urbanToForestMask)
  .or(forestToSwampMask)
  .or(paddyToForestMask)
  .or(stableCroplandMask)
  .or(stableWaterMask)
  .or(croplandToForestMask)
  .or(urbanReversionMask);

var refinedDisagreementMask = initialDisagreementMask.and(noChangeMask.not());
Map.addLayer(refinedDisagreementMask.selfMask(), {palette: 'orange'}, 'Refined (Logical) Disagreement Mask', false);
print('Logical rules applied to refine disagreement mask.');

// ----------------------------------------------------------------------------------
// 4. Spatial-Morphological Optimization
// ----------------------------------------------------------------------------------
print('\n--- Step 3: Optimizing the final change mask with morphology ---');
var openedChangeMask = refinedDisagreementMask
  .focal_min({radius: 1, units: 'pixels'})
  .focal_max({radius: 1, units: 'pixels'});
var changePatches = openedChangeMask.connectedPixelCount({maxSize: 1024});
var finalChangeMask = openedChangeMask.updateMask(changePatches.gte(changePatchMinSize));
Map.addLayer(finalChangeMask.selfMask(), {palette: 'red'}, 'Final "True" Change Mask', true);
print('Morphological optimization applied.');

// ----------------------------------------------------------------------------------
// 5. Generate Logically Corrected Historical Map
// ----------------------------------------------------------------------------------
print('\n--- Step 4: Generating final logically corrected 2020 map ---');

var finalConsistentMap2020 = map2024.where(finalChangeMask, map2020).rename('LULC_2020_Consistent');
Map.addLayer(finalConsistentMap2020, {min: 0, max: 12, palette: palette}, 'Final Logically Corrected 2020 Map', false);
print('\n>>> Success! Final Logically Corrected 2020 Map <<<');

// ==================================================================================
// END OF SCRIPT 5.2
// ==================================================================================

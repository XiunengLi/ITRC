// ==================================================================================
// Script 3.2: Hybrid Classification - Classifier 2 (Gap-Filling) & Merge
// ==================================================================================
// Purpose: 
//         Trains the second RF classifier (Classifier 2) using the 'Annual 
//         Time-Series Statistical Feature Set' to create a gap-free map (Result 2).
//         It then merges Result 1 (from Script 3.1) and Result 2 to create the 
//         final, spatially complete "Raw Classification Map".
// ==================================================================================

// ----------------------------------------------------------------------------------
// 1. SCRIPT PARAMETERS AND SETUP
// ----------------------------------------------------------------------------------

// --- Define Area of Interest (AOI) ---
var processingAndEvalAoi = ee.FeatureCollection('projects/user/assets/aoi');
Map.centerObject(processingAndEvalAoi, 9);
Map.addLayer(processingAndEvalAoi, {color: '009999'}, 'Processing & Evaluation AOI', true, 0.5);

// --- Asset IDs ---
var firstClassificationAssetId = 'projects/user/assets/LULC_Result1_Enhanced_Masked_RAW'; 
var annualRobustFeatureStackId = 'projects/user/assets/FeatureStack_2024_AnnualRobust_NoGaps';
var trainingSamplesAssetId = 'projects/ee-user/assets/2024_landcover_polygons';

// --- Classification Parameters ---
var classProperty = 'landcover';
var numberOfClasses = 13;
var seed = 0;

var palette = [
  '0000FF', // 0: River
  '00FFFF', // 1: Lake
  'A9A9A9', // 2: Mudflat
  'FFFF00', // 3: Paddy_Field
  'FFC0CB', // 4: Aquaculture_Pond
  '800080', // 5: Reservoir
  'FF0000', // 6: Built-up_Land
  'FFA500', // 7: Dry_Cropland
  '006400', // 8: Forest
  '9ACD32', // 9: Grassland
  'D2B48C', // 10: Bare_Land
  '90EE90', // 11: Herbaceous_Wetland
  '556B2F'  // 12: Woody_Wetland
];

// --- Load Assets for Classifier 2 ---
print('--- Loading Assets ---');
// Load the spatially complete annual feature stack
var featureStack_Result2 = ee.Image(annualRobustFeatureStackId).clipToCollection(processingAndEvalAoi);
var bandsForSecondClassification = featureStack_Result2.bandNames();
print('Loaded Annual Time-Series Statistical Feature Set (for gap-filling). Bands:', bandsForSecondClassification);

var trainingSamplesAllRaw = ee.FeatureCollection(trainingSamplesAssetId);
print('Loaded Training Samples. Total polygons from asset:', trainingSamplesAllRaw.size());

// ----------------------------------------------------------------------------------
// 2. PREPARE TRAINING DATA for Classifier 2 (Gap-Filling)
// ----------------------------------------------------------------------------------
print('\n--- Preparing training data for Classifier 2 (Gap-Filling) ---');
var trainingPolygonsInAoi = trainingSamplesAllRaw.filterBounds(processingAndEvalAoi);
var pointsPerClassTarget = 5000;
var allSampledPointsList_scd = [];

for (var i = 0; i < numberOfClasses; i++) {
  var classValue = i;
  var polygonsOfClassInAoi = trainingPolygonsInAoi.filter(ee.Filter.eq(classProperty, classValue));
  if (polygonsOfClassInAoi.size().getInfo() > 0) {
    var classRegion = polygonsOfClassInAoi.geometry().dissolve(ee.ErrorMargin(1));
    if (classRegion.coordinates().size().getInfo() > 0) {
        var points = ee.FeatureCollection.randomPoints({
          region: classRegion,
          points: pointsPerClassTarget,
          seed: seed + classValue
        });
        var pointsWithLabel = points.map(function(p){ return p.set(classProperty, classValue); });
        allSampledPointsList_scd.push(pointsWithLabel);
    }
  } else {
    print('Warning (Classifier 2): No training polygons found for class value: ' + classValue + ' within the AOI.');
  }
}

var sampledPoints_scd = ee.FeatureCollection(allSampledPointsList_scd).flatten();
print('Total sampled points for Classifier 2:', sampledPoints_scd.size());

var trainingDataForSecondClassifier = featureStack_Result2
                                        .select(bandsForSecondClassification)
                                        .sampleRegions({
                                          collection: sampledPoints_scd,
                                          properties: [classProperty],
                                          scale: 30,
                                          tileScale: 16
                                        });
print('Training data prepared for Classifier 2. Number of pixels:', trainingDataForSecondClassifier.size());

// ----------------------------------------------------------------------------------
// 3. SPLIT TRAINING AND VALIDATION DATA (Classifier 2)
// ----------------------------------------------------------------------------------
print('\n--- Splitting data for Classifier 2 ---');
trainingDataForSecondClassifier = trainingDataForSecondClassifier.randomColumn('random_scd', seed);
var trainingSplit_scd = 0.7;
var trainSet_scd = trainingDataForSecondClassifier.filter(ee.Filter.lt('random_scd', trainingSplit_scd));
var validationSet_scd = trainingDataForSecondClassifier.filter(ee.Filter.gte('random_scd', trainingSplit_scd));
print('Classifier 2 - Training set size:', trainSet_scd.size());
print('Classifier 2 - Validation set size:', validationSet_scd.size());

// ----------------------------------------------------------------------------------
// 4. TRAIN Classifier 2 (Annual Statistical)
// ----------------------------------------------------------------------------------
print('\n--- Training Classifier 2 (Annual Statistical) ---');
var classifier_scd = ee.Classifier.smileRandomForest({
  numberOfTrees: 300, seed: seed
}).train({
  features: trainSet_scd,
  classProperty: classProperty,
  inputProperties: bandsForSecondClassification
});
print('Classifier 2 (Gap-Filling) trained.');

// ----------------------------------------------------------------------------------
// 5. CLASSIFY THE IMAGE to create Result 2 (Gap-Free)
// ----------------------------------------------------------------------------------
print('\n--- Classifying to create the gap-free map (Result 2) ---');
var classifiedImage_Result2 = featureStack_Result2
                                .select(bandsForSecondClassification)
                                .classify(classifier_scd)
                                .rename('classification');

Map.addLayer(classifiedImage_Result2, {min: 0, max: numberOfClasses - 1, palette: palette}, 'Classification Result 2 (Gap-Free)', false);

// ----------------------------------------------------------------------------------
// 5. INTEGRATE Result 1 and Result 2 (Gap-Filling)
// ----------------------------------------------------------------------------------
print('\n--- Integrating Result 1 and Result 2 (Gap-Filling) ---');
var classifiedImage_Result1;
try {
  classifiedImage_Result1 = ee.Image(firstClassificationAssetId);
  Map.addLayer(classifiedImage_Result1.clipToCollection(processingAndEvalAoi), {min: 0, max: numberOfClasses - 1, palette: palette}, 'Classification Result 1 (Gappy, RAW)', true); 
  print('Result 1 (gappy, phenology-enhanced map) loaded successfully.');
} catch (error) {
  print('Error loading Result 1 Asset! Check ID and permissions.', error);
  throw new Error('Failed to load Result 1 Asset.');
}

var finalCombinedClassification = classifiedImage_Result1.unmask(classifiedImage_Result2);
finalCombinedClassification = finalCombinedClassification.rename('classification_combined');

Map.addLayer(finalCombinedClassification.clipToCollection(processingAndEvalAoi), {min: 0, max: numberOfClasses - 1, palette: palette}, 'Final Raw Classification Map (Merged)', true); 

// ----------------------------------------------------------------------------------
// 6. EXPORT THE FINAL "RAW CLASSIFICATION MAP" (MERGED)
// ----------------------------------------------------------------------------------
var imageToExport = finalCombinedClassification; // Export the RAW combined classification image

var exportDescription = 'LULC_2024_Final_Combined_RAW'; // (Internal export name)
var exportFileName = 'LULC_2024_Final_Combined_RAW'; // (Internal export name)

print('>>> Preparing to export the final, gap-filled "Raw Classification Map" to Google Drive... <<<');

Export.image.toDrive({
  image: imageToExport, // Exporting the unsmoothed, combined map
  description: exportDescription,
  folder: 'GEE_LULC_Exports_2024_Final',
  fileNamePrefix: exportFileName,
  region: processingAndEvalAoi.geometry(),
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// ==================================================================================
// END OF SCRIPT 3.2
// ==================================================================================

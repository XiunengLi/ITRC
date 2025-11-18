# ITRC: A GEE-Based Framework for Temporally Consistent LULC Reconstruction

This repository contains the official Google Earth Engine (GEE) JavaScript code for the paper:

> **"ITRC: A GEE-Based Framework for Temporally Consistent Reconstruction of Four-Decade Land Cover Dynamics in the Hydrologically Heterogeneous Yangtze River Delta"**
>
> Submitted to: **IEEE Journal of Selected Topics in Applied Earth Observations and Remote Sensing (IEEE JSTARS)**

This framework provides the complete workflow for the **Iterative Temporal Reconstruction and Correction (ITRC)** method described in the manuscript.

## Citation
If you use this code or methodology in your research, please cite our paper:
> [-]

## Workflow and Code Structure
The ITRC framework is implemented in a multi-stage process. The scripts are numbered and must be executed in the order listed below. The steps correspond to the methods described in **Section III Methodology** of the main paper.

---

### Part 1: Reference Year (e.g., 2024) Generation

* **`Script 1: Feature_Engineering.js`**
  
    * **Paper:** Section B (Feature Engineering)
    
    * **Purpose:** Generates the "Key Phenological-Stage" and "Annual Time-Series Statistical" feature sets.

* **`Script 2: Sample_Generation.js`**
  
    * **Paper:** Section C (Training Sample Generation)
    
    * **Purpose:** Provides the GEE visualization environment for creating the high-fidelity reference training polygons.

* **`Script 3.1: Hybrid Classification_Classifier1.js`**
  
    * **Paper:** Section D (Hybrid Classification)
    
    * **Purpose:** Trains Classifier 1 on the "Key Phenological-Stage" (gappy) feature set to produce *Result 1*.

* **`Script 3.2: Hybrid Classification_Classifier2.js`**
  
    * **Paper:** Section D (Hybrid Classification)
    
    * **Purpose:** Trains Classifier 2 on the "Annual Statistical" (gap-free) feature set and merges with *Result 1* to create the "Raw Classification Map".

* **`Script 4: Post-Processing.js`**
  
    * **Paper:** Section E (Post-Processing)
    
    * **Purpose:** Applies the geospatial rule-based pipeline to the "Raw Classification Map" to create the final "Refined LULC Map".

---

### Part 2: Historical Epoch Reconstruction (Iterative)

* **`Script 5.1: Historical Sample Generation.js`**
  
    * **Paper:** Section C (Sample Migration) & F (CVA)
    
    * **Purpose:** Implements the "sample migration and augmentation" strategy using a CVA change mask.

* **`Script 5.2: Consistency Correction.js`**
  
    * **Paper:** Section F (Post-Classification Logical Consistency Constraints)
    
    * **Purpose:** Compares the refined reference map with a refined historical map to correct illogical transitions.

* **`Script 6: Global Asymmetric Temporal Smoothing.js`**
  
    * **Paper:** Section F (Global Asymmetric Temporal Smoothing)
    
    * **Purpose:** Applies the final asymmetric temporal median filter to the entire time series to produce the final, consistent product.

## Key Tunable Parameters

### Post-Processing Parameters (Script 4: Post-Processing.js)

These parameters correspond to the steps detailed in **Section E**:

| Variable Name | Paper Description | Unit |
| :--- | :--- | :--- |
| `protectionMaskErosionRadius` | Protection mask erosion radius | pixel |
| `largeWaterbodyAreaThreshold`| Area threshold for large river reclassification | pixels |
| `openingRadius_PondToRiver` | Pond correction opening radius | pixels |
| `riverConnectingRadius` | Radius for river connection closing | pixels |
| `largeWaterBufferDistanceMeters`| Buffer distance for water body edge refinement | pixels |
| `swampSlopeThreshold` | Maximum slope threshold for woody swamp | degrees |
| `swampTwiThreshold` | Minimum TWI threshold for woody swamp | unitless |
| `swampWaterDistanceThreshold` | Maximum distance-to-water threshold | pixels |
| `minimumPatchSize` | Minimum size threshold for small patch removal (Sieve) | pixels |
| `finalSmoothingRadius` | Radius for conditional smoothing | pixel |


export interface PredictRequest {
  cement: number;
  slag: number;
  fly_ash: number;
  water: number;
  superplasticizer: number;
  coarse_aggregate: number;
  fine_aggregate: number;
  age: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

export interface PredictResponse {
  predicted_strength: number;
  strength_class: string;
  water_cement_ratio: number;
  equivalent_water_binder_ratio: number;
  confidence_interval: ConfidenceInterval;
  ns_en_note: string;
}

export interface OptimizeRequest {
  target_strength: number;
  exposure_class?: string;
  max_cement?: number;
  use_slag?: boolean;
  use_fly_ash?: boolean;
  min_wc?: number;
  max_wc?: number;
  age?: number;
}

export interface MixResult {
  cement: number;
  slag: number;
  fly_ash: number;
  water: number;
  superplasticizer: number;
  coarse_aggregate: number;
  fine_aggregate: number;
}

export interface ExposureCompliance {
  class: string;
  description: string;
  applied_max_wc: number;
  applied_min_cement: number;
  required_min_strength_class: string;
}

export interface OptimizeResponse {
  mix: MixResult;
  predicted_strength: number;
  strength_class: string;
  water_cement_ratio: number;
  equivalent_water_binder_ratio: number;
  exposure_compliance: ExposureCompliance | null;
  ns_en_note: string;
}

export interface ExposureClass {
  description: string;
  max_wc: number;
  min_cement: number;
  min_strength_class: string;
}

export interface StandardsResponse {
  exposure_classes: Record<string, ExposureClass>;
  strength_classes: Record<string, number>;
  model_metrics: {
    test_mae?: number;
    test_r2?: number;
    cv_mae?: number;
    dataset?: string;
    features?: string[];
  };
}

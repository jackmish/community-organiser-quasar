export type RecognitionMode = 'face' | 'ocr' | 'general';

export type NormRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RecognitionProbeSample = NormRect & {
  image_key: string;
};

export type RecognitionProbe = {
  id: string;
  label: string;
  samples: RecognitionProbeSample[];
  /** Legacy mirror of sample rects (no image_key). */
  rects?: NormRect[];
};

export type RecognitionDetection = {
  id: string;
  label: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  text?: string | null;
};

export type RecognitionProbeSummary = {
  label: string;
  sampleCount: number;
  photoCount: number;
};

export type RecognitionSession = {
  session_id: string;
  task_id: string;
  mode: RecognitionMode;
  probes: RecognitionProbe[];
  pending_results: Record<
    string,
    {
      status?: string;
      detections?: RecognitionDetection[];
      buffer_id?: string;
    }
  >;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type PendingFaceDetection = RecognitionDetection & {
  imageKey: string;
};

import { ref, watch, type Ref } from 'vue';
import type { FaceAnnotationRect } from '../mediaFaceAnnotationModel';
import {
  loadAnnotationsForImage,
  loadKnownPersonNames,
  rememberPersonName,
  saveAnnotationsForImage,
} from '../mediaFaceAnnotationStorage';
import {
  loadMediaFaceRecognitionEnabled,
  saveMediaFaceRecognitionEnabled,
} from '../mediaFaceRecognitionSettings';

export function useMediaFaceRecognition(imageKey: Ref<string>) {
  const enabled = ref(loadMediaFaceRecognitionEnabled());
  const selectMode = ref(false);
  const annotations = ref<FaceAnnotationRect[]>([]);
  const knownNames = ref<string[]>(loadKnownPersonNames());
  const highlightedLabel = ref('');

  function reloadForImage(key: string): void {
    annotations.value = loadAnnotationsForImage(key);
    knownNames.value = loadKnownPersonNames();
    highlightedLabel.value = '';
    selectMode.value = false;
  }

  watch(
    imageKey,
    (key) => {
      reloadForImage(key);
    },
    { immediate: true },
  );

  watch(enabled, (value) => {
    saveMediaFaceRecognitionEnabled(value);
    if (!value) {
      selectMode.value = false;
      highlightedLabel.value = '';
    }
  });

  function persistAnnotations(): void {
    saveAnnotationsForImage(imageKey.value, annotations.value);
    knownNames.value = loadKnownPersonNames();
  }

  function setEnabled(value: boolean): void {
    enabled.value = value;
  }

  function toggleEnabled(): void {
    enabled.value = !enabled.value;
  }

  function toggleSelectMode(): void {
    selectMode.value = !selectMode.value;
  }

  function addAnnotation(rect: FaceAnnotationRect): void {
    annotations.value = [...annotations.value, rect];
    if (rect.label) rememberPersonName(rect.label);
    persistAnnotations();
  }

  function updateAnnotation(rect: FaceAnnotationRect): void {
    annotations.value = annotations.value.map((item) => (item.id === rect.id ? rect : item));
    if (rect.label) rememberPersonName(rect.label);
    persistAnnotations();
  }

  function removeAnnotation(id: string): void {
    annotations.value = annotations.value.filter((item) => item.id !== id);
    persistAnnotations();
  }

  function highlightLabel(label: string): void {
    highlightedLabel.value = highlightedLabel.value === label ? '' : label;
  }

  return {
    enabled,
    selectMode,
    annotations,
    knownNames,
    highlightedLabel,
    setEnabled,
    toggleEnabled,
    toggleSelectMode,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    highlightLabel,
    reloadForImage,
  };
}

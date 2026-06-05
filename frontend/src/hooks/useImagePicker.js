import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const useImagePicker = () => {
  const pickImage = async (source = CameraSource.Prompt) => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source
      });
      const response = await fetch(image.dataUrl);
      const blob = await response.blob();
      return { dataUrl: image.dataUrl, blob };
    } catch (error) {
      console.log('User cancelled or error', error);
      return null;
    }
  };
  return { pickImage };
};


import { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export function useFirebaseStorage() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = (file: File, path: string = 'images') => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setFileUrl(null);

    // Create a unique file name
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (uploadError) => {
        console.error("Upload error:", uploadError);
        // More specific error messages
        switch (uploadError.code) {
          case 'storage/unauthorized':
            setError('No tienes permiso para subir archivos. Revisa las reglas de seguridad de Firebase Storage.');
            break;
          case 'storage/canceled':
            setError('La subida fue cancelada.');
            break;
          case 'storage/unknown':
            setError('Ocurrió un error desconocido durante la subida.');
            break;
          default:
            setError(`Error al subir el archivo: ${uploadError.message}`);
        }
        setIsUploading(false);
      },
      () => {
        // Upload completed successfully, now we can get the download URL
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setFileUrl(downloadURL);
          setIsUploading(false);
          setUploadProgress(0);
        });
      }
    );
  };

  return { uploadFile, uploadProgress, isUploading, fileUrl, error };
}

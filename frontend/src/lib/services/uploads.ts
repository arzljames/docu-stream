import axiosInstance from "./axios-instance";

export type UploadDocumentInput = {
  category: string;
  description: string;
  file: File;
  subCategory: string;
  title: string;
};

type MediaUploadResponse = {
  data?: {
    fileZUID?: string;
  };
};

async function uploadMediaFile(file: File) {
  const formData = new FormData();

  formData.append("file", file, file.name);

  const response = await axiosInstance.post<MediaUploadResponse>(
    "/api/media/upload",
    formData,
  );
  const fileZuid = response.data.data?.fileZUID;

  if (!fileZuid) {
    throw new Error("Media upload did not return a file ZUID.");
  }

  return fileZuid;
}

async function createContentItem(input: UploadDocumentInput, fileZuid: string) {
  const response = await axiosInstance.post("/api/content/items", {
    data: {
      category: input.category,
      description: input.description,
      file: fileZuid,
      sub_category: input.subCategory,
      title: input.title,
    },
  });

  return response.data;
}

export async function uploadDocument(input: UploadDocumentInput) {
  const fileZuid = await uploadMediaFile(input.file);

  return createContentItem(input, fileZuid);
}

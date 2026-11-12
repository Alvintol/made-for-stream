import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MAX_VIDEO_SAMPLES,
  MAX_WORK_SAMPLES,
  MIN_WORK_SAMPLES,
  REQUIRED_RECENT_UPLOAD_DESCRIPTION,
  REQUIRED_RECENT_UPLOAD_TITLE,
} from "../../domain/creatorApplication/creatorApplication";
import { supabase } from "../../lib/supabaseClient";
import { alertAdminOfApplication } from "./alertAdminOfApplication";

export type SellerApplicationSampleType = "link" | "image" | "video";

export type SellerApplicationSampleRow = {
  id: string;
  application_id: string;
  sample_type: SellerApplicationSampleType;
  title: string;
  description: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const SAMPLE_COLUMNS = `
  id,
  application_id,
  sample_type,
  title,
  description,
  url,
  storage_path,
  file_name,
  mime_type,
  file_size_bytes,
  sort_order,
  created_at,
  updated_at
`;

const samplesKey = (applicationId: string | null) => ["mySellerApplicationSamples", applicationId];

const fetchSamples = async (applicationId: string): Promise<SellerApplicationSampleRow[]> => {
  const { data, error } = await supabase
    .from("seller_application_samples")
    .select(SAMPLE_COLUMNS)
    .eq("application_id", applicationId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as SellerApplicationSampleRow[];
};

type LinkSampleInput = {
  applicationId: string;
  title: string;
  description: string;
  url: string;
  sortOrder: number;
};

const insertLinkSample = async (input: LinkSampleInput): Promise<SellerApplicationSampleRow> => {
  const { data, error } = await supabase
    .from("seller_application_samples")
    .insert({
      application_id: input.applicationId,
      sample_type: "link",
      title: input.title,
      description: input.description || null,
      url: input.url,
      sort_order: input.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .select(SAMPLE_COLUMNS)
    .single();

  if (error) throw error;

  return data as SellerApplicationSampleRow;
};

type RecentUploadInput = {
  applicationId: string;
  sampleId?: string;
  url: string;
  sortOrder: number;
};

// The required "most recent upload" sample is a link sample with a fixed title.
const saveRecentUpload = async (input: RecentUploadInput): Promise<SellerApplicationSampleRow> => {
  if (!input.sampleId) {
    return insertLinkSample({
      applicationId: input.applicationId,
      title: REQUIRED_RECENT_UPLOAD_TITLE,
      description: REQUIRED_RECENT_UPLOAD_DESCRIPTION,
      url: input.url,
      sortOrder: input.sortOrder,
    });
  }

  const { data, error } = await supabase
    .from("seller_application_samples")
    .update({
      title: REQUIRED_RECENT_UPLOAD_TITLE,
      description: REQUIRED_RECENT_UPLOAD_DESCRIPTION,
      url: input.url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sampleId)
    .select(SAMPLE_COLUMNS)
    .single();

  if (error) throw error;

  return data as SellerApplicationSampleRow;
};

const deleteSample = async (sampleId: string) => {
  const { error } = await supabase.from("seller_application_samples").delete().eq("id", sampleId);

  if (error) throw error;
};

export const useSellerApplicationSamples = (applicationId: string | null) =>
  useQuery<SellerApplicationSampleRow[]>({
    queryKey: samplesKey(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 30_000,
    queryFn: () => (applicationId ? fetchSamples(applicationId) : Promise.resolve([])),
  });

export const useSellerApplicationSampleMutations = (applicationId: string | null) => {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: samplesKey(applicationId) });
  };

  const addLinkSample = useMutation({ mutationFn: insertLinkSample, onSuccess: refresh });
  const saveRecentUploadLink = useMutation({ mutationFn: saveRecentUpload, onSuccess: refresh });
  const removeSample = useMutation({ mutationFn: deleteSample, onSuccess: refresh });

  return { addLinkSample, saveRecentUploadLink, removeSample };
};

type SubmitInput = {
  applicationId: string;
  sampleCount: number;
  videoCount: number;
};

const submitApplication = async (input: SubmitInput) => {
  // The RPC enforces these too; checking first gives a clearer message.
  if (input.sampleCount < MIN_WORK_SAMPLES) {
    throw new Error(`Add at least ${MIN_WORK_SAMPLES} work samples before submitting.`);
  }

  if (input.sampleCount > MAX_WORK_SAMPLES) {
    throw new Error(`You can submit a maximum of ${MAX_WORK_SAMPLES} work samples.`);
  }

  if (input.videoCount > MAX_VIDEO_SAMPLES) {
    throw new Error(`Only ${MAX_VIDEO_SAMPLES} video sample is allowed per application.`);
  }

  const { data, error } = await supabase.rpc("submit_seller_application", {
    application_id: input.applicationId,
  });

  if (error) throw error;

  return Array.isArray(data) ? data[0] : data;
};

export const useSubmitSellerApplication = (userId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitApplication,
    onSuccess: async (_data, input) => {
      // Not awaited: the email never holds up or undoes the submission.
      void alertAdminOfApplication(input.applicationId);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mySellerApplication", userId] }),
        queryClient.invalidateQueries({ queryKey: ["creatorApplicationQueueState"] }),
      ]);
    },
  });
};

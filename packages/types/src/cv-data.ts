/** A span in the cleaned transcript from which a CV field was derived. */
export interface TranscriptSpan {
  startMs: number;
  endMs: number;
  text: string;
}

export interface WorkExperience {
  employer: string;
  role: string;
  startDate: string | null;
  endDate: string | null;
  responsibilities: string[];
  /** Source spans in the transcript for this entry */
  sourceSpans: TranscriptSpan[];
}

export interface Education {
  institution: string;
  qualification: string;
  startDate: string | null;
  endDate: string | null;
  /** Source spans in the transcript for this entry */
  sourceSpans: TranscriptSpan[];
}

/**
 * Structured CV data extracted from the cleaned transcript.
 * Every field maps back to one or more TranscriptSpans (Requirement 4.2).
 */
export interface CV_Data {
  name: string | null;
  contactDetails: {
    email: string | null;
    phone: string | null;
    location: string | null;
  };
  professionalSummary: string | null;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
  /** Fields that could not be extracted and require manual input */
  missingFields: Array<keyof Omit<CV_Data, "missingFields">>;
}

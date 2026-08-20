/**
 * Trellis domain declaration: durable record schemas for the academic and
 * career workbench. The domain is opened through `ctx.storageDomain` and
 * served by the configured SQLite backend in the Trellis profile.
 * @module @trellis/trellis/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { TrellisDocumentId, TrellisRelationId } from './types.ts'

/** Trellis document id at the durable boundary; branding has no runtime representation. */
const trellisDocumentId = z.string().min(1).transform(value => value as TrellisDocumentId)

/** Trellis relation id at the durable boundary; branding has no runtime representation. */
const trellisRelationId = z.string().min(1).transform(value => value as TrellisRelationId)

/** Supported knowledge-document categories. */
export const knowledgeDocumentKind = z.enum(['webpage', 'document', 'note', 'other'])
/** Supported knowledge-document categories. */
export type KnowledgeDocumentKind = z.infer<typeof knowledgeDocumentKind>

/** How one knowledge document relates to another. */
export const knowledgeRelationKind = z.enum([
  'references',
  'supports',
  'contradicts',
  'extends',
  'example',
  'related',
])
/** How one knowledge document relates to another. */
export type KnowledgeRelationKind = z.infer<typeof knowledgeRelationKind>

/** Provenance retained for an archived document. */
export const knowledgeSource = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('url'),
    url: z.string(),
    retrieval: z.enum(['fetched', 'provided']),
    statusCode: z.number().int().optional(),
    fetchedAt: z.string().optional(),
    truncated: z.boolean(),
  }),
  z.object({
    type: z.literal('file'),
    name: z.string(),
    mediaType: z.string().optional(),
  }),
  z.object({ type: z.literal('pasted') }),
])
/** Provenance retained for an archived document. */
export type KnowledgeSource = z.infer<typeof knowledgeSource>

/** One evidence-bearing directed relation stored with its source document. */
export const knowledgeRelationRecord = z.object({
  id: trellisRelationId,
  targetId: trellisDocumentId,
  kind: knowledgeRelationKind,
  label: z.string().optional(),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
  createdAt: z.string(),
})
/** One evidence-bearing directed relation stored with its source document. */
export type KnowledgeRelationRecord = z.infer<typeof knowledgeRelationRecord>

/** One source-backed document in the Trellis knowledge graph. */
export const knowledgeDocumentRecord = z.object({
  id: trellisDocumentId,
  kind: knowledgeDocumentKind,
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  source: knowledgeSource,
  relations: z.array(knowledgeRelationRecord),
  createdAt: z.string(),
  updatedAt: z.string(),
})
/** One source-backed document in the Trellis knowledge graph. */
export type KnowledgeDocumentRecord = z.infer<typeof knowledgeDocumentRecord>

/** One collected or imported job posting. */
export const jobRecord = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  url: z.string().optional(),
  description: z.string().default(''),
  posted_at: z.string().optional(),
  deadline: z.string().optional(),
  status: z.string().default('watching'),
  tags: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One collected or imported job posting. */
export type JobRecord = z.infer<typeof jobRecord>

/** One professional contact worth tracking. */
export const contactRecord = z.object({
  id: z.string(),
  name: z.string(),
  linkedin_url: z.string().optional(),
  headline: z.string().optional(),
  company: z.string().optional(),
  relationship: z.string().optional(),
  notes: z.string().default(''),
  outreach_stage: z.string().default('not_contacted'),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One professional contact worth tracking. */
export type ContactRecord = z.infer<typeof contactRecord>

/** One job application. */
export const applicationRecord = z.object({
  id: z.string(),
  job_id: z.string(),
  applied_at: z.string().optional(),
  status: z.string().default('draft'),
  resume_version: z.string().optional(),
  cover_letter: z.string().default(''),
  next_action: z.string().default(''),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One job application. */
export type ApplicationRecord = z.infer<typeof applicationRecord>

/** One course in the catalog or transcript. */
export const courseRecord = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  semester: z.string().optional(),
  grade: z.string().optional(),
  status: z.string().default('planned'),
  prerequisites: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One course in the catalog or transcript. */
export type CourseRecord = z.infer<typeof courseRecord>

/** One graduation requirement bucket. */
export const degreeRequirementRecord = z.object({
  id: z.string(),
  category: z.string(),
  required_credits: z.number(),
  completed_credits: z.number().default(0),
  notes: z.string().default(''),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One graduation requirement bucket. */
export type DegreeRequirementRecord = z.infer<typeof degreeRequirementRecord>

/** One term plan linking courses and a target GPA. */
export const academicPlanRecord = z.object({
  id: z.string(),
  term: z.string(),
  course_ids: z.array(z.string()).default([]),
  target_gpa: z.number().optional(),
  notes: z.string().default(''),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One term plan linking courses and a target GPA. */
export type AcademicPlanRecord = z.infer<typeof academicPlanRecord>

/** One knowledge note, optionally linked to jobs, contacts, and courses. */
export const noteRecord = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().default(''),
  kind: z.string().default('note'),
  tags: z.array(z.string()).default([]),
  links: z.array(z.string()).default([]),
  source_url: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One knowledge note, optionally linked to jobs, contacts, and courses. */
export type NoteRecord = z.infer<typeof noteRecord>

/** One tracked information source (job board, school page, competition list). */
export const sourceRecord = z.object({
  id: z.string(),
  kind: z.string().default('website'),
  name: z.string(),
  url: z.string(),
  query: z.string().optional(),
  check_frequency: z.string().default('weekly'),
  last_checked_at: z.string().optional(),
  enabled: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One tracked information source (job board, school page, competition list). */
export type SourceRecord = z.infer<typeof sourceRecord>

/** One competition or scholarship opportunity. */
export const competitionRecord = z.object({
  id: z.string(),
  name: z.string(),
  organizer: z.string().optional(),
  url: z.string().optional(),
  deadline: z.string().optional(),
  reward: z.string().optional(),
  fit_score: z.number().optional(),
  notes: z.string().default(''),
  created_at: z.string(),
  updated_at: z.string(),
})
/** One competition or scholarship opportunity. */
export type CompetitionRecord = z.infer<typeof competitionRecord>

/** Trellis domain state: a simple initialized marker for future migrations. */
export const trellisDomainState = z.object({
  initialized: z.boolean(),
})

/**
 * The Trellis domain spec. One SQLite database unit with all workbench
 * tables; the domain name is `trellis` and the record format is v2.
 */
export const trellisDomainSpec = defineDomain({
  name: 'trellis',
  version: 2,
  global: {
    schema: trellisDomainState,
    initial: { initialized: true },
  },
  tables: {
    jobs: domainTable<string, JobRecord>(jobRecord),
    contacts: domainTable<string, ContactRecord>(contactRecord),
    applications: domainTable<string, ApplicationRecord>(applicationRecord),
    courses: domainTable<string, CourseRecord>(courseRecord),
    degree_requirements: domainTable<string, DegreeRequirementRecord>(degreeRequirementRecord),
    academic_plans: domainTable<string, AcademicPlanRecord>(academicPlanRecord),
    notes: domainTable<string, NoteRecord>(noteRecord),
    sources: domainTable<string, SourceRecord>(sourceRecord),
    competitions: domainTable<string, CompetitionRecord>(competitionRecord),
    knowledge_documents: domainTable<TrellisDocumentId, KnowledgeDocumentRecord>(knowledgeDocumentRecord),
  },
})

-- Create enum type "account_status"
CREATE TYPE "public"."account_status" AS ENUM ('active', 'blocked', 'disabled');
-- Create enum type "account_type"
CREATE TYPE "public"."account_type" AS ENUM ('person', 'service');
-- Create enum type "alert_trigger_type"
CREATE TYPE "public"."alert_trigger_type" AS ENUM ('manual', 'automatic', 'external_integration');
-- Create enum type "case_status"
CREATE TYPE "public"."case_status" AS ENUM ('open', 'closed');
-- Create enum type "emergency_alert_status"
CREATE TYPE "public"."emergency_alert_status" AS ENUM ('received', 'acknowledged', 'dispatched', 'resolved');
-- Create enum type "evidence_type"
CREATE TYPE "public"."evidence_type" AS ENUM ('image', 'video', 'audio', 'document', 'other');
-- Create enum type "incident_severity"
CREATE TYPE "public"."incident_severity" AS ENUM ('low', 'medium', 'high', 'critical');
-- Create enum type "incident_type"
CREATE TYPE "public"."incident_type" AS ENUM ('physical_violence', 'psychological_violence', 'sexual_violence', 'property_violence', 'moral_violence', 'protective_order_breach', 'other');
-- Create enum type "notification_channel"
CREATE TYPE "public"."notification_channel" AS ENUM ('push', 'sms', 'email');
-- Create enum type "notification_status"
CREATE TYPE "public"."notification_status" AS ENUM ('pending', 'processing', 'sent', 'delivered', 'failed');
-- Create enum type "organization_type"
CREATE TYPE "public"."organization_type" AS ENUM ('public_agency', 'nonprofit', 'private_organization', 'other');
-- Create enum type "protective_order_term_status"
CREATE TYPE "public"."protective_order_term_status" AS ENUM ('active', 'suspended', 'revoked', 'expired');
-- Create enum type "protective_order_term_type"
CREATE TYPE "public"."protective_order_term_type" AS ENUM ('no_contact', 'minimum_distance', 'place_restriction', 'weapon_restriction', 'other');
-- Create enum type "risk_level"
CREATE TYPE "public"."risk_level" AS ENUM ('low', 'medium', 'high', 'critical');

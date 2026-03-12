import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260312031950 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "refund_request" drop constraint if exists "refund_request_idempotency_key_unique";`);
    this.addSql(`alter table if exists "coin_grant" drop constraint if exists "coin_grant_app_order_id_unique";`);
    this.addSql(`create table if not exists "coin_grant" ("id" text not null, "app_order_id" text not null, "open_id" text null, "user_id" text null, "amount" numeric not null, "pay_coin_symbol" text not null, "order_scene_type" text null, "status" text check ("status" in ('pending', 'success', 'failed')) not null default 'pending', "external_order_num" text null, "error_code" text null, "error_message" text null, "initiated_by" text null, "metadata" jsonb null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "coin_grant_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_coin_grant_app_order_id_unique" ON "coin_grant" ("app_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_coin_grant_deleted_at" ON "coin_grant" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_coin_grant_status" ON "coin_grant" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "refund_request" ("id" text not null, "order_id" text not null, "payment_id" text not null, "customer_id" text not null, "amount" numeric not null, "currency_code" text not null, "reason" text null, "note" text null, "status" text check ("status" in ('pending', 'approved', 'rejected', 'refunded', 'failed')) not null default 'pending', "idempotency_key" text null, "reviewed_by" text null, "reviewed_at" timestamptz null, "review_note" text null, "refunded_at" timestamptz null, "failed_at" timestamptz null, "failure_reason" text null, "external_refund_order_num" text null, "metadata" jsonb null, "raw_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "refund_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refund_request_idempotency_key_unique" ON "refund_request" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_refund_request_deleted_at" ON "refund_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_refund_request_order_id" ON "refund_request" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_refund_request_payment_id" ON "refund_request" ("payment_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_refund_request_customer_id_status" ON "refund_request" ("customer_id", "status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "coin_grant" cascade;`);

    this.addSql(`drop table if exists "refund_request" cascade;`);
  }

}

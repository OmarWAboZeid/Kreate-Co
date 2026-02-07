alter table campaign_packages drop column organization_id;

drop index if exists campaign_packages_org_id_idx;

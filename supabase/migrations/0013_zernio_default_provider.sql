-- Phase 1.5: Zernio is the default publisher. Old rows keep 'upload-post'.
alter table post_targets alter column provider set default 'zernio';

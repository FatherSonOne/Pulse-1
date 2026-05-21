// usePermissionMatrix — loads the role / permission matrix for a workspace
// from the public.permissions + workspace_roles + role_permissions catalog.
//
// Substrate landed in migration 20260521000000_permissions_catalog_substrate.
// Issue #42 Sub-PR 2: the matrix card and the role-help popover read from
// this hook so the canonical reference is no longer a JS literal.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export interface PermissionMatrixRole {
  key: string;
  name: string;
  rank: number;
  is_system: boolean;
}

export interface PermissionMatrixRow {
  key: string;
  category: string;
  label: string;
  description: string | null;
  /** role_key -> granted */
  roles: Record<string, boolean>;
}

export interface UsePermissionMatrixReturn {
  rows: PermissionMatrixRow[];
  /** Ordered ascending by rank (owner first). */
  roles: PermissionMatrixRole[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY: UsePermissionMatrixReturn = {
  rows: [],
  roles: [],
  isLoading: false,
  error: null,
  refresh: async () => {},
};

export function usePermissionMatrix(
  workspaceId: string | null | undefined,
): UsePermissionMatrixReturn {
  const [rows, setRows] = useState<PermissionMatrixRow[]>([]);
  const [roles, setRoles] = useState<PermissionMatrixRole[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setRows([]);
      setRoles([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [{ data: permsData, error: permsErr },
             { data: rolesData, error: rolesErr }] = await Promise.all([
        supabase
          .from('permissions')
          .select('key,category,label,description,created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('workspace_roles')
          .select('id,key,name,rank,is_system')
          .eq('workspace_id', workspaceId)
          .order('rank', { ascending: true }),
      ]);
      if (permsErr) throw permsErr;
      if (rolesErr) throw rolesErr;

      const roleList = rolesData ?? [];
      const roleIds = roleList.map(r => r.id);

      let grants: { role_id: string; permission_key: string }[] = [];
      if (roleIds.length) {
        const { data, error: grantsErr } = await supabase
          .from('role_permissions')
          .select('role_id,permission_key')
          .in('role_id', roleIds);
        if (grantsErr) throw grantsErr;
        grants = data ?? [];
      }

      const roleKeyById: Record<string, string> = {};
      for (const r of roleList) roleKeyById[r.id] = r.key;

      const grantSet = new Set<string>();
      for (const g of grants) {
        const rk = roleKeyById[g.role_id];
        if (rk) grantSet.add(`${rk}::${g.permission_key}`);
      }

      const assembled: PermissionMatrixRow[] = (permsData ?? []).map(p => {
        const roleGrants: Record<string, boolean> = {};
        for (const r of roleList) {
          roleGrants[r.key] = grantSet.has(`${r.key}::${p.key}`);
        }
        return {
          key: p.key,
          category: p.category,
          label: p.label,
          description: p.description ?? null,
          roles: roleGrants,
        };
      });

      setRows(assembled);
      setRoles(
        roleList.map(r => ({
          key: r.key,
          name: r.name,
          rank: r.rank,
          is_system: r.is_system,
        })),
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Failed to load permission matrix';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!workspaceId) return { ...EMPTY };

  return { rows, roles, isLoading, error, refresh };
}

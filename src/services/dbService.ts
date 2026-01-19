import { ArchiveItem, ArchiveType } from '../types';
import { dataService } from './dataService';

// Use Supabase for archives persistence
export const saveArchiveItem = async (item: Omit<ArchiveItem, 'id' | 'date'>): Promise<ArchiveItem> => {
  const saved = await dataService.createArchive({
    ...item,
    date: new Date(),
  });
  
  if (!saved) {
    throw new Error('Failed to save archive item');
  }
  
  return saved;
};

export const getArchives = async (): Promise<ArchiveItem[]> => {
  return await dataService.getArchives();
};

export const searchArchives = async (query: string, typeFilter?: ArchiveType): Promise<ArchiveItem[]> => {
  const all = await getArchives();
  const lowerQ = query.toLowerCase();
  
  return all.filter(item => {
    const matchesType = typeFilter ? item.type === typeFilter : true;
    const matchesQuery = 
      item.title.toLowerCase().includes(lowerQ) || 
      item.content.toLowerCase().includes(lowerQ) ||
      item.tags.some(t => t.toLowerCase().includes(lowerQ));
    
    return matchesType && matchesQuery;
  });
};

export const deleteArchiveItem = async (id: string): Promise<boolean> => {
  // Note: dataService doesn't have deleteArchive yet, but archives are stored in Supabase
  // For now, we'll need to add this method to dataService
  // This is a placeholder that will work once deleteArchive is implemented
  const { supabase } = await import('./supabase');
  const userId = dataService.getUserId();
  
  const { error } = await supabase
    .from('archives')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  
  return !error;
};
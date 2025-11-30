import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as projectService from '../services/projectService';
import { Project } from '../types';

export const useProjects = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['projects'],
        queryFn: () => projectService.getProjects(),
        enabled,
    });
};

export const useProjectMutations = () => {
    const queryClient = useQueryClient();

    return {
        addProject: useMutation({
            mutationFn: projectService.addProject,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
        }),
        updateProject: useMutation({
            mutationFn: projectService.updateProject,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
        }),
        deleteProject: useMutation({
            mutationFn: projectService.deleteProject,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
        }),
    };
};
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

    const createProjectMutation = useMutation({
        mutationFn: projectService.addProject,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    });

    const updateProjectMutation = useMutation({
        mutationFn: projectService.updateProject,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    });

    const deleteProjectMutation = useMutation({
        mutationFn: projectService.deleteProject,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    });

    return {
        createProject: createProjectMutation.mutateAsync,
        updateProject: updateProjectMutation.mutateAsync,
        deleteProject: deleteProjectMutation.mutateAsync,
    };
};
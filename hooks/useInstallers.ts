import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as installerService from '../services/installerService';
import { Installer } from '../types';

export const useInstallers = (enabled: boolean = true) => {
    return useQuery<Installer[], Error>({
        queryKey: ['installers'],
        queryFn: installerService.getInstallers,
        enabled,
    });
};

export const useInstallerMutations = () => {
    const queryClient = useQueryClient();

    const createInstallerMutation = useMutation({
        mutationFn: installerService.addInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
        },
    });

    const updateInstallerMutation = useMutation({
        mutationFn: installerService.updateInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
        },
    });

    const deleteInstallerMutation = useMutation({
        mutationFn: installerService.deleteInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
        },
    });

    return {
        createInstaller: createInstallerMutation,
        updateInstaller: updateInstallerMutation,
        deleteInstaller: deleteInstallerMutation,
    };
};
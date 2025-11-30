import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as installerService from '../services/installerService';

export const useInstallers = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['installers'],
        queryFn: installerService.getInstallers,
        enabled,
    });
};

export const useInstallerMutations = () => {
    const queryClient = useQueryClient();

    return {
        addInstaller: useMutation({
            mutationFn: installerService.addInstaller,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installers'] }),
        }),
        updateInstaller: useMutation({
            mutationFn: installerService.updateInstaller,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installers'] }),
        }),
        deleteInstaller: useMutation({
            mutationFn: installerService.deleteInstaller,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installers'] }),
        }),
    };
};
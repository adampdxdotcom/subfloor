import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as installerService from '../services/installerService';
import { toast } from 'react-hot-toast';

export const useInstallerMutations = (onSuccessCallback?: () => void) => {
    const queryClient = useQueryClient();

    const createInstaller = useMutation({
        mutationFn: installerService.addInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
            toast.success("Installer created.");
            onSuccessCallback?.();
        },
        onError: (err: Error) => toast.error(`Creation failed: ${err.message}`),
    });

    const updateInstaller = useMutation({
        mutationFn: installerService.updateInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
            toast.success("Installer updated.");
            onSuccessCallback?.();
        },
        onError: (err: Error) => toast.error(`Update failed: ${err.message}`),
    });

    const deleteInstaller = useMutation({
        mutationFn: installerService.deleteInstaller,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['installers'] });
            toast.success('Installer deleted successfully.');
            onSuccessCallback?.();
        },
        onError: (err: Error) => toast.error(`Deletion failed: ${err.message}`),
    });

    return {
        addInstaller: createInstaller.mutateAsync,
        updateInstaller: updateInstaller.mutateAsync,
        deleteInstaller: deleteInstaller.mutateAsync,
    };
};
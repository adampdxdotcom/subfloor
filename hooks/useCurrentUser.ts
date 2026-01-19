import { useQuery } from '@tanstack/react-query';
import * as userService from '../services/userService';
import { CurrentUser } from '../types';

export const useCurrentUser = () => {
    return useQuery<CurrentUser, Error>({
        queryKey: ['currentUser'],
        queryFn: userService.getCurrentUser,
    });
};
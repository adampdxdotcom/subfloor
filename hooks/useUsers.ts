import { useQuery } from '@tanstack/react-query';
import * as userService from '../services/userService';
import { User } from '../types';

export const useUsers = () => {
    return useQuery<User[], Error>({
        queryKey: ['users'],
        queryFn: userService.getUsers,
    });
};
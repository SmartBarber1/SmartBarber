import {
    Routes
} from '@angular/router';

import {
    authGuard
} from '../../core/auth/guards/auth.guard';

import {
    roleGuard
} from '../../core/auth/guards/role.guard';

import {
    UserManagementRepository
} from './domain/repositories/user-management.repository';

import {
    UserManagementApiService
} from './infrastructure/api/user-management-api.service';

import {
    GetUserUseCase
} from './application/use-cases/get-user.use-case';

import {
    BlockUserUseCase
} from './application/use-cases/block-user.use-case';

import {
    EmployeeRepository
} from '../employee/domain/repositories/employee.repository';

import {
    EmployeeApiService
} from '../employee/infrastructure/api/employee-api.service';

import {
    CreateEmployeeUseCase
} from '../employee/application/use-cases/create-employee.use-case';
import {
    GetEmployeesByBarbershopUseCase
} from '../employee/application/use-cases/get-employees-by-barbershop.use-case';


export const USER_MANAGEMENT_ROUTES:
    Routes = [

        {
            path: '',

            canActivate: [
                authGuard,
                roleGuard
            ],

            data: {
                roles: ['ADMIN']
            },

            providers: [

                {
                    provide:
                        UserManagementRepository,

                    useClass:
                        UserManagementApiService
                },

                {
                    provide:
                        EmployeeRepository,

                    useClass:
                        EmployeeApiService
                },

                GetUserUseCase,

                BlockUserUseCase,

                CreateEmployeeUseCase,
                GetEmployeesByBarbershopUseCase
            ],

            loadComponent: () =>
                import(
                    './pages/user-management/user-management.component'
                ).then(
                    m =>
                        m.UserManagementComponent
                )
        }
    ];